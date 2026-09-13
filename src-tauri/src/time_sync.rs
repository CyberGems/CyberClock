//! Clock accuracy: measure how far the local system clock is from a
//! network time source. The primary source is SNTP over UDP/123
//! (sub-second precision, no privileges needed, read-only); the
//! fallback reads the HTTP `Date` header over TCP/80 for networks
//! that block NTP. Neither path ever writes the system clock.

use chrono::DateTime;
use log::warn;
use std::net::{TcpStream, ToSocketAddrs, UdpSocket};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const NTP_SERVERS: [&str; 3] = ["pool.ntp.org", "time.windows.com", "time.google.com"];
const HTTP_HOSTS: [&str; 2] = ["www.cloudflare.com", "www.google.com"];
const TIMEOUT: Duration = Duration::from_secs(3);

/// One successful measurement.
pub struct Measurement {
    /// server_time - local_time at receive, in milliseconds.
    /// Positive means the local clock runs BEHIND the true time.
    pub drift_ms: i64,
    /// "ntp" (UDP/123) or "http-date" (TCP/80 fallback).
    pub source: &'static str,
}

/// Try every source, SNTP first. Returns the last error when all fail.
pub fn measure() -> Result<Measurement, String> {
    let mut last_err = String::from("no time source reachable");
    for server in NTP_SERVERS {
        match sntp_offset_ms(server) {
            Ok(drift_ms) => {
                return Ok(Measurement {
                    drift_ms,
                    source: "ntp",
                })
            }
            Err(e) => {
                warn!("time_sync: sntp {} failed: {}", server, e);
                last_err = format!("{}: {}", server, e);
            }
        }
    }
    for host in HTTP_HOSTS {
        match http_date_offset_ms(host) {
            Ok(drift_ms) => {
                return Ok(Measurement {
                    drift_ms,
                    source: "http-date",
                })
            }
            Err(e) => {
                warn!("time_sync: http-date {} failed: {}", host, e);
                last_err = format!("{}: {}", host, e);
            }
        }
    }
    Err(last_err)
}

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Classic SNTP client: one 48-byte request, parse t2/t3, compute the
/// offset ((t2 - t1) + (t3 - t4)) / 2 which cancels path latency to
/// first order.
fn sntp_offset_ms(server: &str) -> Result<i64, String> {
    let addr = (server, 123u16)
        .to_socket_addrs()
        .map_err(|e| format!("resolve: {}", e))?
        .next()
        .ok_or_else(|| "resolve returned no address".to_string())?;

    // Windows creates IPv6 sockets with V6ONLY by default, so the bind
    // family must match the resolved address or IPv4 targets fail.
    let bind_addr = if addr.is_ipv4() {
        "0.0.0.0:0"
    } else {
        "[::]:0"
    };
    let socket = UdpSocket::bind(bind_addr).map_err(|e| format!("bind: {}", e))?;
    socket
        .set_read_timeout(Some(TIMEOUT))
        .map_err(|e| e.to_string())?;
    socket
        .set_write_timeout(Some(TIMEOUT))
        .map_err(|e| e.to_string())?;
    socket
        .connect(addr)
        .map_err(|e| format!("connect: {}", e))?;

    let mut request = [0u8; 48];
    request[0] = 0x23; // LI = 0, VN = 4, Mode = 3 (client)

    let t1 = now_unix_ms();
    socket.send(&request).map_err(|e| format!("send: {}", e))?;
    let mut response = [0u8; 48];
    let (n, _) = socket
        .recv_from(&mut response)
        .map_err(|e| format!("recv: {}", e))?;
    let t4 = now_unix_ms();

    if n < 48 {
        return Err(format!("short response ({} bytes)", n));
    }
    let mode = response[0] & 0b0000_0111;
    if mode != 4 && mode != 5 {
        return Err(format!("unexpected mode {}", mode));
    }
    if response[1] == 0 {
        // Kiss-of-death: server refused to serve time.
        return Err("kiss-of-death (stratum 0)".to_string());
    }

    let t2 = ntp_timestamp_ms(&response[32..40]);
    let t3 = ntp_timestamp_ms(&response[40..48]);
    if t2 <= 0 || t3 <= 0 {
        return Err("server did not set its timestamps".to_string());
    }

    Ok((((t2 - t1 as i128) + (t3 - t4 as i128)) / 2) as i64)
}

/// Convert an NTP 64-bit timestamp (seconds + fraction since
/// 1900-01-01) to unix milliseconds.
fn ntp_timestamp_ms(bytes: &[u8]) -> i128 {
    let secs = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as i128;
    // Fraction scaled to milliseconds: frac / 2^32 * 1000.
    let frac = u32::from_be_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]) as i128;
    (secs - 2_208_988_800) * 1000 + ((frac * 1000) >> 32)
}

/// Fallback for networks that block UDP/123: read the HTTP `Date`
/// header over TCP/80. Resolution is 1 second and the value does not
/// compensate round-trip time, which is fine for a minute-scale
/// warning threshold.
fn http_date_offset_ms(host: &str) -> Result<i64, String> {
    let server_ms = fetch_http_date_ms(host)?;
    Ok((server_ms - now_unix_ms() as i128) as i64)
}

fn fetch_http_date_ms(host: &str) -> Result<i128, String> {
    let mut stream = TcpStream::connect((host, 80)).map_err(|e| format!("connect: {}", e))?;
    stream
        .set_read_timeout(Some(TIMEOUT))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(TIMEOUT))
        .map_err(|e| e.to_string())?;

    let request = format!(
        "HEAD / HTTP/1.1\r\nHost: {}\r\nConnection: close\r\nUser-Agent: CyberClock\r\n\r\n",
        host
    );
    use std::io::{Read, Write};
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("send: {}", e))?;

    let mut response = Vec::new();
    // Cap the read: headers are tiny, a hostile server must not balloon it.
    stream
        .take(16 * 1024)
        .read_to_end(&mut response)
        .map_err(|e| format!("recv: {}", e))?;
    let text = String::from_utf8_lossy(&response);

    let date_line = text
        .lines()
        .find(|l| l.len() > 5 && l[..5].eq_ignore_ascii_case("date:"))
        .ok_or_else(|| "response has no Date header".to_string())?;
    let value = date_line[5..].trim();

    let server = DateTime::parse_from_rfc2822(value)
        .map_err(|e| format!("unparseable Date {:?}: {}", value, e))?;
    Ok(server.timestamp_millis() as i128)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ntp_timestamp_converts_to_unix_ms() {
        // 2026-01-01T00:00:00Z == unix 1767225600 == NTP 3976214400.
        let secs: u32 = 3_976_214_400;
        let bytes = secs.to_be_bytes();
        let mut ts = [0u8; 8];
        ts[..4].copy_from_slice(&bytes);
        // Zero fraction -> exact second.
        assert_eq!(ntp_timestamp_ms(&ts), 1_767_225_600_000);

        // Half the fraction field == 500 ms.
        let mut ts_half = ts;
        ts_half[4..].copy_from_slice(&0x8000_0000u32.to_be_bytes());
        assert_eq!(ntp_timestamp_ms(&ts_half), 1_767_225_600_500);
    }

    #[test]
    fn sntp_offset_math_uses_average_of_both_directions() {
        // t1 = 1000, t2 = 3000, t3 = 3002, t4 = 1004
        // offset = ((3000-1000) + (3002-1004)) / 2 = 1999 ms
        let t1 = 1000i64;
        let t2 = 3000i128;
        let t3 = 3002i128;
        let t4 = 1004i64;
        assert_eq!((((t2 - t1 as i128) + (t3 - t4 as i128)) / 2) as i64, 1999);
    }

    #[test]
    fn http_date_parses_rfc1123() {
        let parsed = DateTime::parse_from_rfc2822("Sat, 12 Sep 2026 23:27:18 GMT").unwrap();
        assert_eq!(parsed.timestamp(), 1_789_255_638);
    }
}
