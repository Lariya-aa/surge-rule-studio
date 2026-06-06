export type ConnectivityStatus = "direct" | "likely-direct" | "likely-proxy" | "proxy" | "unknown";

export interface ConnectivityResult {
  host: string;
  status: ConnectivityStatus;
  reason: string;
  resolvedIps: string[];
  isChinaIp: boolean;
}

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface CloudflareDnsResponse {
  Answer?: DnsAnswer[];
  Status: number;
}

interface GoogleDnsResponse {
  Answer?: DnsAnswer[];
  Status: number;
}

const CHINA_IP_RANGES: Array<[number, number]> = [
  // Major Chinese ISP and cloud provider ranges
  [ipToLong("1.0.1.0"), ipToLong("1.0.3.255")],
  [ipToLong("1.2.0.0"), ipToLong("1.2.0.255")],
  [ipToLong("1.2.2.0"), ipToLong("1.2.2.255")],
  [ipToLong("1.4.1.0"), ipToLong("1.4.2.255")],
  [ipToLong("1.8.0.0"), ipToLong("1.8.255.255")],
  [ipToLong("1.10.0.0"), ipToLong("1.10.7.255")],
  [ipToLong("1.12.0.0"), ipToLong("1.12.255.255")],
  [ipToLong("1.24.0.0"), ipToLong("1.31.255.255")],
  [ipToLong("1.45.0.0"), ipToLong("1.45.255.255")],
  [ipToLong("1.48.0.0"), ipToLong("1.51.255.255")],
  [ipToLong("1.56.0.0"), ipToLong("1.63.255.255")],
  [ipToLong("1.68.0.0"), ipToLong("1.71.255.255")],
  [ipToLong("1.80.0.0"), ipToLong("1.87.255.255")],
  [ipToLong("1.92.0.0"), ipToLong("1.95.255.255")],
  [ipToLong("1.180.0.0"), ipToLong("1.183.255.255")],
  [ipToLong("1.188.0.0"), ipToLong("1.191.255.255")],
  [ipToLong("1.192.0.0"), ipToLong("1.195.255.255")],
  [ipToLong("1.202.0.0"), ipToLong("1.203.255.255")],
  [ipToLong("1.204.0.0"), ipToLong("1.207.255.255")],
  [ipToLong("14.0.0.0"), ipToLong("14.1.255.255")],
  [ipToLong("14.104.0.0"), ipToLong("14.111.255.255")],
  [ipToLong("14.112.0.0"), ipToLong("14.119.255.255")],
  [ipToLong("14.130.0.0"), ipToLong("14.131.255.255")],
  [ipToLong("14.144.0.0"), ipToLong("14.159.255.255")],
  [ipToLong("14.160.0.0"), ipToLong("14.175.255.255")],
  [ipToLong("14.192.0.0"), ipToLong("14.207.255.255")],
  [ipToLong("14.208.0.0"), ipToLong("14.223.255.255")],
  [ipToLong("27.8.0.0"), ipToLong("27.15.255.255")],
  [ipToLong("27.16.0.0"), ipToLong("27.31.255.255")],
  [ipToLong("27.36.0.0"), ipToLong("27.39.255.255")],
  [ipToLong("27.40.0.0"), ipToLong("27.55.255.255")],
  [ipToLong("27.106.0.0"), ipToLong("27.106.127.255")],
  [ipToLong("27.115.0.0"), ipToLong("27.115.127.255")],
  [ipToLong("27.184.0.0"), ipToLong("27.191.255.255")],
  [ipToLong("36.0.0.0"), ipToLong("36.3.255.255")],
  [ipToLong("36.4.0.0"), ipToLong("36.7.255.255")],
  [ipToLong("36.16.0.0"), ipToLong("36.31.255.255")],
  [ipToLong("36.32.0.0"), ipToLong("36.35.255.255")],
  [ipToLong("36.36.0.0"), ipToLong("36.39.255.255")],
  [ipToLong("36.40.0.0"), ipToLong("36.43.255.255")],
  [ipToLong("36.44.0.0"), ipToLong("36.47.255.255")],
  [ipToLong("36.56.0.0"), ipToLong("36.63.255.255")],
  [ipToLong("36.96.0.0"), ipToLong("36.127.255.255")],
  [ipToLong("36.128.0.0"), ipToLong("36.159.255.255")],
  [ipToLong("36.192.0.0"), ipToLong("36.223.255.255")],
  [ipToLong("36.248.0.0"), ipToLong("36.255.255.255")],
  [ipToLong("39.0.0.0"), ipToLong("39.1.255.255")],
  [ipToLong("39.4.0.0"), ipToLong("39.7.255.255")],
  [ipToLong("39.8.0.0"), ipToLong("39.15.255.255")],
  [ipToLong("39.64.0.0"), ipToLong("39.95.255.255")],
  [ipToLong("39.96.0.0"), ipToLong("39.127.255.255")],
  [ipToLong("39.128.0.0"), ipToLong("39.159.255.255")],
  [ipToLong("39.176.0.0"), ipToLong("39.183.255.255")],
  [ipToLong("39.192.0.0"), ipToLong("39.255.255.255")],
  [ipToLong("42.0.0.0"), ipToLong("42.3.255.255")],
  [ipToLong("42.4.0.0"), ipToLong("42.7.255.255")],
  [ipToLong("42.48.0.0"), ipToLong("42.55.255.255")],
  [ipToLong("42.56.0.0"), ipToLong("42.63.255.255")],
  [ipToLong("42.80.0.0"), ipToLong("42.95.255.255")],
  [ipToLong("42.96.0.0"), ipToLong("42.127.255.255")],
  [ipToLong("42.128.0.0"), ipToLong("42.159.255.255")],
  [ipToLong("42.176.0.0"), ipToLong("42.191.255.255")],
  [ipToLong("42.192.0.0"), ipToLong("42.223.255.255")],
  [ipToLong("42.224.0.0"), ipToLong("42.255.255.255")],
  [ipToLong("43.224.0.0"), ipToLong("43.231.255.255")],
  [ipToLong("43.236.0.0"), ipToLong("43.239.255.255")],
  [ipToLong("43.240.0.0"), ipToLong("43.247.255.255")],
  [ipToLong("45.64.0.0"), ipToLong("45.67.255.255")],
  [ipToLong("45.112.0.0"), ipToLong("45.119.255.255")],
  [ipToLong("45.120.0.0"), ipToLong("45.127.255.255")],
  [ipToLong("45.248.0.0"), ipToLong("45.255.255.255")],
  [ipToLong("47.92.0.0"), ipToLong("47.103.255.255")],
  [ipToLong("47.104.0.0"), ipToLong("47.111.255.255")],
  [ipToLong("49.64.0.0"), ipToLong("49.95.255.255")],
  [ipToLong("49.112.0.0"), ipToLong("49.127.255.255")],
  [ipToLong("58.0.0.0"), ipToLong("58.63.255.255")],
  [ipToLong("58.64.0.0"), ipToLong("58.95.255.255")],
  [ipToLong("58.96.0.0"), ipToLong("58.127.255.255")],
  [ipToLong("58.128.0.0"), ipToLong("58.159.255.255")],
  [ipToLong("58.160.0.0"), ipToLong("58.191.255.255")],
  [ipToLong("58.192.0.0"), ipToLong("58.223.255.255")],
  [ipToLong("58.224.0.0"), ipToLong("58.255.255.255")],
  [ipToLong("59.32.0.0"), ipToLong("59.63.255.255")],
  [ipToLong("59.64.0.0"), ipToLong("59.95.255.255")],
  [ipToLong("59.96.0.0"), ipToLong("59.127.255.255")],
  [ipToLong("59.128.0.0"), ipToLong("59.159.255.255")],
  [ipToLong("59.160.0.0"), ipToLong("59.191.255.255")],
  [ipToLong("59.192.0.0"), ipToLong("59.255.255.255")],
  [ipToLong("60.0.0.0"), ipToLong("60.31.255.255")],
  [ipToLong("60.32.0.0"), ipToLong("60.63.255.255")],
  [ipToLong("60.64.0.0"), ipToLong("60.127.255.255")],
  [ipToLong("60.128.0.0"), ipToLong("60.159.255.255")],
  [ipToLong("60.160.0.0"), ipToLong("60.191.255.255")],
  [ipToLong("60.192.0.0"), ipToLong("60.255.255.255")],
  [ipToLong("61.0.0.0"), ipToLong("61.31.255.255")],
  [ipToLong("61.32.0.0"), ipToLong("61.47.255.255")],
  [ipToLong("61.48.0.0"), ipToLong("61.63.255.255")],
  [ipToLong("61.64.0.0"), ipToLong("61.95.255.255")],
  [ipToLong("61.96.0.0"), ipToLong("61.127.255.255")],
  [ipToLong("61.128.0.0"), ipToLong("61.159.255.255")],
  [ipToLong("61.160.0.0"), ipToLong("61.191.255.255")],
  [ipToLong("61.192.0.0"), ipToLong("61.223.255.255")],
  [ipToLong("61.224.0.0"), ipToLong("61.255.255.255")],
  [ipToLong("101.0.0.0"), ipToLong("101.31.255.255")],
  [ipToLong("101.32.0.0"), ipToLong("101.63.255.255")],
  [ipToLong("101.64.0.0"), ipToLong("101.95.255.255")],
  [ipToLong("101.96.0.0"), ipToLong("101.127.255.255")],
  [ipToLong("101.128.0.0"), ipToLong("101.159.255.255")],
  [ipToLong("101.160.0.0"), ipToLong("101.191.255.255")],
  [ipToLong("101.192.0.0"), ipToLong("101.223.255.255")],
  [ipToLong("101.224.0.0"), ipToLong("101.255.255.255")],
  [ipToLong("103.0.0.0"), ipToLong("103.7.255.255")],
  [ipToLong("103.8.0.0"), ipToLong("103.15.255.255")],
  [ipToLong("103.16.0.0"), ipToLong("103.31.255.255")],
  [ipToLong("103.32.0.0"), ipToLong("103.63.255.255")],
  [ipToLong("106.0.0.0"), ipToLong("106.3.255.255")],
  [ipToLong("106.4.0.0"), ipToLong("106.7.255.255")],
  [ipToLong("106.8.0.0"), ipToLong("106.15.255.255")],
  [ipToLong("106.16.0.0"), ipToLong("106.31.255.255")],
  [ipToLong("106.32.0.0"), ipToLong("106.63.255.255")],
  [ipToLong("106.64.0.0"), ipToLong("106.127.255.255")],
  [ipToLong("106.128.0.0"), ipToLong("106.159.255.255")],
  [ipToLong("106.160.0.0"), ipToLong("106.191.255.255")],
  [ipToLong("106.192.0.0"), ipToLong("106.255.255.255")],
  [ipToLong("110.0.0.0"), ipToLong("110.15.255.255")],
  [ipToLong("110.16.0.0"), ipToLong("110.31.255.255")],
  [ipToLong("110.32.0.0"), ipToLong("110.63.255.255")],
  [ipToLong("110.64.0.0"), ipToLong("110.95.255.255")],
  [ipToLong("110.96.0.0"), ipToLong("110.127.255.255")],
  [ipToLong("110.128.0.0"), ipToLong("110.159.255.255")],
  [ipToLong("110.160.0.0"), ipToLong("110.191.255.255")],
  [ipToLong("110.192.0.0"), ipToLong("110.223.255.255")],
  [ipToLong("110.224.0.0"), ipToLong("110.255.255.255")],
  [ipToLong("111.0.0.0"), ipToLong("111.63.255.255")],
  [ipToLong("111.64.0.0"), ipToLong("111.95.255.255")],
  [ipToLong("111.96.0.0"), ipToLong("111.127.255.255")],
  [ipToLong("111.128.0.0"), ipToLong("111.159.255.255")],
  [ipToLong("111.160.0.0"), ipToLong("111.191.255.255")],
  [ipToLong("111.192.0.0"), ipToLong("111.223.255.255")],
  [ipToLong("111.224.0.0"), ipToLong("111.255.255.255")],
  [ipToLong("112.0.0.0"), ipToLong("112.31.255.255")],
  [ipToLong("112.32.0.0"), ipToLong("112.63.255.255")],
  [ipToLong("112.64.0.0"), ipToLong("112.95.255.255")],
  [ipToLong("112.96.0.0"), ipToLong("112.127.255.255")],
  [ipToLong("112.128.0.0"), ipToLong("112.159.255.255")],
  [ipToLong("112.160.0.0"), ipToLong("112.191.255.255")],
  [ipToLong("112.192.0.0"), ipToLong("112.223.255.255")],
  [ipToLong("112.224.0.0"), ipToLong("112.255.255.255")],
  [ipToLong("113.0.0.0"), ipToLong("113.63.255.255")],
  [ipToLong("113.64.0.0"), ipToLong("113.95.255.255")],
  [ipToLong("113.96.0.0"), ipToLong("113.127.255.255")],
  [ipToLong("113.128.0.0"), ipToLong("113.159.255.255")],
  [ipToLong("113.160.0.0"), ipToLong("113.191.255.255")],
  [ipToLong("113.192.0.0"), ipToLong("113.223.255.255")],
  [ipToLong("113.224.0.0"), ipToLong("113.255.255.255")],
  [ipToLong("114.64.0.0"), ipToLong("114.95.255.255")],
  [ipToLong("114.96.0.0"), ipToLong("114.127.255.255")],
  [ipToLong("114.128.0.0"), ipToLong("114.159.255.255")],
  [ipToLong("114.160.0.0"), ipToLong("114.191.255.255")],
  [ipToLong("114.192.0.0"), ipToLong("114.223.255.255")],
  [ipToLong("114.224.0.0"), ipToLong("114.255.255.255")],
  [ipToLong("115.0.0.0"), ipToLong("115.31.255.255")],
  [ipToLong("115.32.0.0"), ipToLong("115.63.255.255")],
  [ipToLong("115.84.0.0"), ipToLong("115.95.255.255")],
  [ipToLong("115.96.0.0"), ipToLong("115.127.255.255")],
  [ipToLong("115.128.0.0"), ipToLong("115.159.255.255")],
  [ipToLong("115.160.0.0"), ipToLong("115.191.255.255")],
  [ipToLong("115.192.0.0"), ipToLong("115.223.255.255")],
  [ipToLong("115.224.0.0"), ipToLong("115.255.255.255")],
  [ipToLong("116.0.0.0"), ipToLong("116.31.255.255")],
  [ipToLong("116.32.0.0"), ipToLong("116.63.255.255")],
  [ipToLong("116.64.0.0"), ipToLong("116.95.255.255")],
  [ipToLong("116.96.0.0"), ipToLong("116.127.255.255")],
  [ipToLong("116.128.0.0"), ipToLong("116.159.255.255")],
  [ipToLong("116.160.0.0"), ipToLong("116.191.255.255")],
  [ipToLong("116.192.0.0"), ipToLong("116.223.255.255")],
  [ipToLong("116.224.0.0"), ipToLong("116.255.255.255")],
  [ipToLong("117.0.0.0"), ipToLong("117.31.255.255")],
  [ipToLong("117.32.0.0"), ipToLong("117.63.255.255")],
  [ipToLong("117.64.0.0"), ipToLong("117.95.255.255")],
  [ipToLong("117.96.0.0"), ipToLong("117.127.255.255")],
  [ipToLong("117.128.0.0"), ipToLong("117.159.255.255")],
  [ipToLong("117.160.0.0"), ipToLong("117.191.255.255")],
  [ipToLong("117.192.0.0"), ipToLong("117.223.255.255")],
  [ipToLong("117.224.0.0"), ipToLong("117.255.255.255")],
  [ipToLong("118.64.0.0"), ipToLong("118.95.255.255")],
  [ipToLong("118.112.0.0"), ipToLong("118.127.255.255")],
  [ipToLong("118.132.0.0"), ipToLong("118.143.255.255")],
  [ipToLong("118.144.0.0"), ipToLong("118.159.255.255")],
  [ipToLong("118.160.0.0"), ipToLong("118.191.255.255")],
  [ipToLong("118.192.0.0"), ipToLong("118.223.255.255")],
  [ipToLong("118.224.0.0"), ipToLong("118.255.255.255")],
  [ipToLong("119.0.0.0"), ipToLong("119.31.255.255")],
  [ipToLong("119.32.0.0"), ipToLong("119.63.255.255")],
  [ipToLong("119.64.0.0"), ipToLong("119.95.255.255")],
  [ipToLong("119.96.0.0"), ipToLong("119.127.255.255")],
  [ipToLong("119.128.0.0"), ipToLong("119.159.255.255")],
  [ipToLong("119.160.0.0"), ipToLong("119.191.255.255")],
  [ipToLong("119.192.0.0"), ipToLong("119.223.255.255")],
  [ipToLong("119.224.0.0"), ipToLong("119.255.255.255")],
  [ipToLong("120.0.0.0"), ipToLong("120.15.255.255")],
  [ipToLong("120.16.0.0"), ipToLong("120.31.255.255")],
  [ipToLong("120.32.0.0"), ipToLong("120.63.255.255")],
  [ipToLong("120.64.0.0"), ipToLong("120.95.255.255")],
  [ipToLong("120.96.0.0"), ipToLong("120.127.255.255")],
  [ipToLong("120.128.0.0"), ipToLong("120.159.255.255")],
  [ipToLong("120.160.0.0"), ipToLong("120.191.255.255")],
  [ipToLong("120.192.0.0"), ipToLong("120.223.255.255")],
  [ipToLong("120.224.0.0"), ipToLong("120.255.255.255")],
  [ipToLong("121.0.0.0"), ipToLong("121.31.255.255")],
  [ipToLong("121.32.0.0"), ipToLong("121.63.255.255")],
  [ipToLong("121.64.0.0"), ipToLong("121.95.255.255")],
  [ipToLong("121.96.0.0"), ipToLong("121.127.255.255")],
  [ipToLong("121.128.0.0"), ipToLong("121.159.255.255")],
  [ipToLong("121.160.0.0"), ipToLong("121.191.255.255")],
  [ipToLong("121.192.0.0"), ipToLong("121.223.255.255")],
  [ipToLong("121.224.0.0"), ipToLong("121.255.255.255")],
  [ipToLong("122.0.0.0"), ipToLong("122.31.255.255")],
  [ipToLong("122.48.0.0"), ipToLong("122.63.255.255")],
  [ipToLong("122.64.0.0"), ipToLong("122.95.255.255")],
  [ipToLong("122.96.0.0"), ipToLong("122.127.255.255")],
  [ipToLong("122.128.0.0"), ipToLong("122.159.255.255")],
  [ipToLong("122.160.0.0"), ipToLong("122.191.255.255")],
  [ipToLong("122.192.0.0"), ipToLong("122.223.255.255")],
  [ipToLong("122.224.0.0"), ipToLong("122.255.255.255")],
  [ipToLong("123.0.0.0"), ipToLong("123.31.255.255")],
  [ipToLong("123.32.0.0"), ipToLong("123.63.255.255")],
  [ipToLong("123.64.0.0"), ipToLong("123.95.255.255")],
  [ipToLong("123.96.0.0"), ipToLong("123.127.255.255")],
  [ipToLong("123.128.0.0"), ipToLong("123.159.255.255")],
  [ipToLong("123.160.0.0"), ipToLong("123.191.255.255")],
  [ipToLong("123.192.0.0"), ipToLong("123.223.255.255")],
  [ipToLong("123.224.0.0"), ipToLong("123.255.255.255")],
  [ipToLong("124.0.0.0"), ipToLong("124.15.255.255")],
  [ipToLong("124.16.0.0"), ipToLong("124.31.255.255")],
  [ipToLong("124.64.0.0"), ipToLong("124.95.255.255")],
  [ipToLong("124.96.0.0"), ipToLong("124.127.255.255")],
  [ipToLong("124.128.0.0"), ipToLong("124.159.255.255")],
  [ipToLong("124.160.0.0"), ipToLong("124.191.255.255")],
  [ipToLong("124.192.0.0"), ipToLong("124.223.255.255")],
  [ipToLong("124.224.0.0"), ipToLong("124.255.255.255")],
  [ipToLong("125.0.0.0"), ipToLong("125.31.255.255")],
  [ipToLong("125.32.0.0"), ipToLong("125.63.255.255")],
  [ipToLong("125.64.0.0"), ipToLong("125.95.255.255")],
  [ipToLong("125.96.0.0"), ipToLong("125.127.255.255")],
  [ipToLong("125.128.0.0"), ipToLong("125.159.255.255")],
  [ipToLong("125.160.0.0"), ipToLong("125.191.255.255")],
  [ipToLong("125.192.0.0"), ipToLong("125.223.255.255")],
  [ipToLong("125.224.0.0"), ipToLong("125.255.255.255")],
  [ipToLong("159.226.0.0"), ipToLong("159.227.255.255")],
  [ipToLong("161.207.0.0"), ipToLong("161.207.255.255")],
  [ipToLong("162.105.0.0"), ipToLong("162.105.255.255")],
  [ipToLong("166.111.0.0"), ipToLong("166.111.255.255")],
  [ipToLong("167.139.0.0"), ipToLong("167.139.255.255")],
  [ipToLong("168.160.0.0"), ipToLong("168.160.255.255")],
  [ipToLong("202.0.0.0"), ipToLong("202.3.255.255")],
  [ipToLong("202.4.0.0"), ipToLong("202.7.255.255")],
  [ipToLong("202.8.0.0"), ipToLong("202.15.255.255")],
  [ipToLong("202.16.0.0"), ipToLong("202.31.255.255")],
  [ipToLong("202.32.0.0"), ipToLong("202.63.255.255")],
  [ipToLong("202.64.0.0"), ipToLong("202.95.255.255")],
  [ipToLong("202.96.0.0"), ipToLong("202.127.255.255")],
  [ipToLong("202.128.0.0"), ipToLong("202.159.255.255")],
  [ipToLong("202.160.0.0"), ipToLong("202.191.255.255")],
  [ipToLong("202.192.0.0"), ipToLong("202.223.255.255")],
  [ipToLong("202.224.0.0"), ipToLong("202.255.255.255")],
  [ipToLong("210.0.0.0"), ipToLong("210.31.255.255")],
  [ipToLong("210.32.0.0"), ipToLong("210.63.255.255")],
  [ipToLong("210.64.0.0"), ipToLong("210.95.255.255")],
  [ipToLong("210.96.0.0"), ipToLong("210.127.255.255")],
  [ipToLong("210.128.0.0"), ipToLong("210.159.255.255")],
  [ipToLong("210.160.0.0"), ipToLong("210.191.255.255")],
  [ipToLong("210.192.0.0"), ipToLong("210.223.255.255")],
  [ipToLong("210.224.0.0"), ipToLong("210.255.255.255")],
  [ipToLong("211.64.0.0"), ipToLong("211.95.255.255")],
  [ipToLong("211.96.0.0"), ipToLong("211.127.255.255")],
  [ipToLong("211.128.0.0"), ipToLong("211.159.255.255")],
  [ipToLong("211.160.0.0"), ipToLong("211.191.255.255")],
  [ipToLong("211.192.0.0"), ipToLong("211.223.255.255")],
  [ipToLong("211.224.0.0"), ipToLong("211.255.255.255")],
  [ipToLong("218.0.0.0"), ipToLong("218.31.255.255")],
  [ipToLong("218.32.0.0"), ipToLong("218.63.255.255")],
  [ipToLong("218.64.0.0"), ipToLong("218.95.255.255")],
  [ipToLong("218.96.0.0"), ipToLong("218.127.255.255")],
  [ipToLong("218.128.0.0"), ipToLong("218.159.255.255")],
  [ipToLong("218.160.0.0"), ipToLong("218.191.255.255")],
  [ipToLong("218.192.0.0"), ipToLong("218.223.255.255")],
  [ipToLong("218.224.0.0"), ipToLong("218.255.255.255")],
  [ipToLong("219.64.0.0"), ipToLong("219.95.255.255")],
  [ipToLong("219.96.0.0"), ipToLong("219.127.255.255")],
  [ipToLong("219.128.0.0"), ipToLong("219.159.255.255")],
  [ipToLong("219.160.0.0"), ipToLong("219.191.255.255")],
  [ipToLong("219.192.0.0"), ipToLong("219.223.255.255")],
  [ipToLong("219.224.0.0"), ipToLong("219.255.255.255")],
  [ipToLong("220.96.0.0"), ipToLong("220.127.255.255")],
  [ipToLong("220.128.0.0"), ipToLong("220.159.255.255")],
  [ipToLong("220.160.0.0"), ipToLong("220.191.255.255")],
  [ipToLong("220.192.0.0"), ipToLong("220.223.255.255")],
  [ipToLong("220.224.0.0"), ipToLong("220.255.255.255")],
  [ipToLong("221.0.0.0"), ipToLong("221.31.255.255")],
  [ipToLong("221.32.0.0"), ipToLong("221.63.255.255")],
  [ipToLong("221.64.0.0"), ipToLong("221.95.255.255")],
  [ipToLong("221.96.0.0"), ipToLong("221.127.255.255")],
  [ipToLong("221.128.0.0"), ipToLong("221.159.255.255")],
  [ipToLong("221.160.0.0"), ipToLong("221.191.255.255")],
  [ipToLong("221.192.0.0"), ipToLong("221.223.255.255")],
  [ipToLong("221.224.0.0"), ipToLong("221.255.255.255")],
  [ipToLong("222.0.0.0"), ipToLong("222.31.255.255")],
  [ipToLong("222.32.0.0"), ipToLong("222.63.255.255")],
  [ipToLong("222.64.0.0"), ipToLong("222.95.255.255")],
  [ipToLong("222.96.0.0"), ipToLong("222.127.255.255")],
  [ipToLong("222.128.0.0"), ipToLong("222.159.255.255")],
  [ipToLong("222.160.0.0"), ipToLong("222.191.255.255")],
  [ipToLong("222.192.0.0"), ipToLong("222.223.255.255")],
  [ipToLong("222.224.0.0"), ipToLong("222.255.255.255")],
];

export function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function isChinaIp(ip: string): boolean {
  const long = ipToLong(ip);
  if (long === 0) return false;
  let low = 0;
  let high = CHINA_IP_RANGES.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const [start, end] = CHINA_IP_RANGES[mid];
    if (long < start) {
      high = mid - 1;
    } else if (long > end) {
      low = mid + 1;
    } else {
      return true;
    }
  }
  return false;
}

export async function resolveDns(
  host: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const ips = new Set<string>();

  try {
    const cfUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`;
    const cfResp = await fetcher(cfUrl, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
    if (cfResp.ok) {
      const cfData = (await cfResp.json()) as CloudflareDnsResponse;
      if (cfData.Status === 0 && cfData.Answer) {
        for (const answer of cfData.Answer) {
          if (answer.type === 1 && answer.data) {
            ips.add(answer.data);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  if (ips.size === 0) {
    try {
      const googleUrl = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`;
      const googleResp = await fetcher(googleUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (googleResp.ok) {
        const googleData = (await googleResp.json()) as GoogleDnsResponse;
        if (googleData.Status === 0 && googleData.Answer) {
          for (const answer of googleData.Answer) {
            if (answer.type === 1 && answer.data) {
              ips.add(answer.data);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(ips);
}

export async function checkConnectivity(
  host: string,
  fetcher: typeof fetch = fetch,
): Promise<ConnectivityResult> {
  const isCnDomain = host.endsWith(".cn") || host.endsWith(".com.cn") || host.endsWith(".net.cn") || host.endsWith(".org.cn");

  if (isCnDomain) {
    const ips = await resolveDns(host, fetcher);
    return {
      host,
      status: "direct",
      reason: "Chinese TLD domain",
      resolvedIps: ips,
      isChinaIp: true,
    };
  }

  const ips = await resolveDns(host, fetcher);

  if (ips.length === 0) {
    return {
      host,
      status: "unknown",
      reason: "DNS resolution failed",
      resolvedIps: [],
      isChinaIp: false,
    };
  }

  const chinaIps = ips.filter(isChinaIp);
  const isChina = chinaIps.length > 0;

  if (isChina) {
    return {
      host,
      status: "likely-direct",
      reason: `Resolved to Chinese IP${chinaIps.length > 1 ? "s" : ""}: ${chinaIps.join(", ")}`,
      resolvedIps: ips,
      isChinaIp: true,
    };
  }

  return {
    host,
    status: "likely-proxy",
    reason: `Resolved to non-Chinese IP${ips.length > 1 ? "s" : ""}: ${ips.slice(0, 3).join(", ")}`,
    resolvedIps: ips,
    isChinaIp: false,
  };
}

export async function batchCheckConnectivity(
  hosts: string[],
  fetcher: typeof fetch = fetch,
): Promise<ConnectivityResult[]> {
  const unique = Array.from(new Set(hosts.filter(Boolean)));
  const results = await Promise.allSettled(
    unique.map((host) => checkConnectivity(host, fetcher)),
  );
  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      host: unique[index],
      status: "unknown" as ConnectivityStatus,
      reason: "Connectivity check failed",
      resolvedIps: [],
      isChinaIp: false,
    };
  });
}
