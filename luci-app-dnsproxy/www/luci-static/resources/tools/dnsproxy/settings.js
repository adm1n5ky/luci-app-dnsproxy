'use strict';
'require form';
'require uci';

return L.Class.extend({
  addSection: function(m) {
    var s, o;

    s = m.section(form.NamedSection, 'settings', _('Settings'));
    s.tab('general', _('General'));
    s.tab('servers', _('Servers'));
    s.tab('cache',   _('Cache'));
    s.tab('tls',     _('TLS / HTTPS / QUIC'));
    s.tab('privacy', _('Privacy & Security'));
    s.tab('perf',    _('Performance'));

    /* ── General ── */
    o = s.taboption('general', form.DynamicList, 'listen_addr',
      _('Listen addresses'), _('Example: 0.0.0.0, ::1'));
    o.placeholder = '0.0.0.0';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'listen_addr'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'listen_addr', val); };

    o = s.taboption('general', form.DynamicList, 'listen_port', _('Listen ports'));
    o.placeholder = '53';
    o.datatype = 'port';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'listen_port'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'listen_port', val); };

    o = s.taboption('general', form.ListValue, 'upstream_mode', _('Upstream mode'),
      _('load_balance: round-robin. parallel: query all. fastest_addr: return fastest IP.'));
    o.value('',             _('load_balance (default)'));
    o.value('load_balance', 'load_balance');
    o.value('parallel',     'parallel');
    o.value('fastest_addr', 'fastest_addr');
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'upstream_mode'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'upstream_mode', val); };

    o = s.taboption('general', form.Flag, 'ipv6_disabled', _('Disable IPv6'),
      _('Reply NOERROR with empty answer to all AAAA requests'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'ipv6_disabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'ipv6_disabled', val); };

    o = s.taboption('general', form.Flag, 'http3', _('Enable HTTP/3'),
      _('Use HTTP/3 for DoH upstreams if available'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'http3'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'http3', val); };

    o = s.taboption('general', form.Flag, 'insecure',
      _('Disable TLS certificate validation'), _('Use only for testing — insecure!'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'insecure'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'insecure', val); };

    o = s.taboption('general', form.Flag, 'verbose', _('Verbose logging'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'verbose'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'verbose', val); };

    o = s.taboption('general', form.Value, 'log_file', _('Log file path'),
      _('Leave empty to log to stdout'));
    o.placeholder = '/var/log/dnsproxy.log';
    o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'log_file'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'log_file', val); };

    /* ── Servers ── */
    o = s.taboption('servers', form.DynamicList, 'upstream', _('Upstream servers'),
      _('Supports plain DNS, DoT (tls://), DoH (https://), DoQ (quic://), DNSCrypt (sdns://)'));
    o.placeholder = 'tls://1.1.1.1';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'servers', 'upstream'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'servers', 'upstream', val); };

    o = s.taboption('servers', form.DynamicList, 'bootstrap', _('Bootstrap servers'),
      _('Plain DNS servers to resolve DoH/DoT hostnames'));
    o.placeholder = '8.8.8.8';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'servers', 'bootstrap'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'servers', 'bootstrap', val); };

    o = s.taboption('servers', form.DynamicList, 'fallback', _('Fallback servers'),
      _('Used when upstream is unavailable'));
    o.placeholder = 'tls://9.9.9.9';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'servers', 'fallback'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'servers', 'fallback', val); };

    /* ── Cache ── */
    o = s.taboption('cache', form.Flag, 'cache_enabled', _('Enable DNS cache'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'enabled', val); };

    o = s.taboption('cache', form.Flag, 'cache_optimistic', _('Optimistic cache'),
      _('Return expired entries immediately and refresh in background'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'cache_optimistic'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'cache_optimistic', val); };

    o = s.taboption('cache', form.Value, 'cache_size', _('Cache size (bytes)'));
    o.placeholder = '65535'; o.datatype = 'uinteger';
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'size'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'size', val); };

    o = s.taboption('cache', form.Value, 'cache_min_ttl', _('Minimum TTL (seconds)'),
      _('Capped at 3600. Use with care.'));
    o.datatype = 'uinteger'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'min_ttl'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'min_ttl', val); };

    o = s.taboption('cache', form.Value, 'cache_max_ttl', _('Maximum TTL (seconds)'));
    o.datatype = 'uinteger'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'max_ttl'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'max_ttl', val); };

    o = s.taboption('cache', form.Value, 'optimistic_answer_ttl',
      _('Optimistic TTL (seconds)'),
      _('TTL for expired entries served from optimistic cache. Default: 30s'));
    o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'optimistic_answer_ttl'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'optimistic_answer_ttl', val); };

    o = s.taboption('cache', form.Value, 'optimistic_max_age', _('Optimistic cache max age'),
      _('Entries older than this are removed. Human-readable, e.g. 12h'));
    o.placeholder = '12h'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'cache', 'optimistic_max_age'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'cache', 'optimistic_max_age', val); };

    /* ── TLS ── */
    o = s.taboption('tls', form.Flag, 'tls_enabled', _('Enable encrypted DNS server'),
      _('Enables DoT / DoH / DoQ server mode'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'enabled', val); };

    o = s.taboption('tls', form.Value, 'tls_crt', _('Certificate file'),
      _('Path to PEM certificate chain'));
    o.placeholder = '/etc/ssl/certs/server.crt'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'tls_crt'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'tls_crt', val); };

    o = s.taboption('tls', form.Value, 'tls_key', _('Private key file'),
      _('Path to PEM private key'));
    o.placeholder = '/etc/ssl/private/server.key'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'tls_key'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'tls_key', val); };

    o = s.taboption('tls', form.Value, 'tls_port', _('DoT port (DNS-over-TLS)'));
    o.placeholder = '853'; o.datatype = 'port'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'tls_port'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'tls_port', val); };

    o = s.taboption('tls', form.Value, 'https_port', _('DoH port (DNS-over-HTTPS)'));
    o.placeholder = '443'; o.datatype = 'port'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'https_port'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'https_port', val); };

    o = s.taboption('tls', form.Value, 'quic_port', _('DoQ port (DNS-over-QUIC)'));
    o.placeholder = '853'; o.datatype = 'port'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'quic_port'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'quic_port', val); };

    o = s.taboption('tls', form.Value, 'https_server_name', _('HTTPS server name'),
      _('Value of the Server header in DoH responses'));
    o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'https_server_name'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'https_server_name', val); };

    o = s.taboption('tls', form.Value, 'https_userinfo', _('DoH Basic Auth'),
      _('Require basic authentication for DoH. Format: user:password'));
    o.rmempty = true; o.password = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'https_userinfo'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'https_userinfo', val); };

    o = s.taboption('tls', form.ListValue, 'tls_min_version', _('Minimum TLS version'));
    o.value('', _('default'));
    ['1.0','1.1','1.2','1.3'].forEach(function(v) { o.value(v, 'TLS ' + v); });
    o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'tls_min_version'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'tls_min_version', val); };

    o = s.taboption('tls', form.ListValue, 'tls_max_version', _('Maximum TLS version'));
    o.value('', _('default'));
    ['1.0','1.1','1.2','1.3'].forEach(function(v) { o.value(v, 'TLS ' + v); });
    o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'tls', 'tls_max_version'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'tls', 'tls_max_version', val); };

    /* ── Privacy & Security ── */
    o = s.taboption('privacy', form.Flag, 'edns_enabled', _('Enable EDNS Client Subnet'),
      _('Pass client IP prefix to upstream for geo-aware responses'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'edns', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'edns', 'enabled', val); };

    o = s.taboption('privacy', form.Value, 'edns_addr', _('EDNS Client Address'),
      _('Override client IP sent to upstream (useful behind NAT)'));
    o.placeholder = '1.2.3.4'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'edns', 'edns_addr'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'edns', 'edns_addr', val); };

    o = s.taboption('privacy', form.DynamicList, 'bogus_nxdomain',
      _('Bogus NXDomain IPs / CIDRs'),
      _('Responses containing these IPs are replaced with NXDOMAIN'));
    o.placeholder = '0.0.0.0'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'bogus_nxdomain', 'ip_addr'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'bogus_nxdomain', 'ip_addr', val); };

    o = s.taboption('privacy', form.Flag, 'private_rdns_enabled',
      _('Use private rDNS upstreams'),
      _('Route PTR/SOA/NS queries for private addresses to local servers'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'private_rdns', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'private_rdns', 'enabled', val); };

    o = s.taboption('privacy', form.DynamicList, 'private_rdns_upstream',
      _('Private rDNS upstreams'), _('Servers for reverse DNS of private addresses'));
    o.placeholder = '127.0.0.1:53'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'private_rdns', 'upstream'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'private_rdns', 'upstream', val); };

    o = s.taboption('privacy', form.DynamicList, 'private_subnets', _('Private subnets'),
      _('Subnets considered private for rDNS routing'));
    o.placeholder = '192.168.0.0/16'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'private_rdns', 'private_subnets'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'private_rdns', 'private_subnets', val); };

    o = s.taboption('privacy', form.Flag, 'dns64_enabled', _('Enable DNS64'),
      _('Synthesize AAAA records for IPv4-only hosts (for NAT64 networks)'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'dns64', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'dns64', 'enabled', val); };

    o = s.taboption('privacy', form.DynamicList, 'dns64_prefix', _('DNS64 prefixes'),
      _('Default: 64:ff9b::/96 (Well-Known Prefix)'));
    o.placeholder = '64:ff9b::'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'dns64', 'dns64_prefix'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'dns64', 'dns64_prefix', val); };

    o = s.taboption('privacy', form.Flag, 'hosts_enabled', _('Use hosts files'),
      _('Resolve names using local hosts files'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'hosts', 'enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'hosts', 'enabled', val); };

    o = s.taboption('privacy', form.DynamicList, 'hosts_files', _('Hosts file paths'));
    o.placeholder = '/etc/hosts'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'hosts', 'hosts_files'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'hosts', 'hosts_files', val); };

    /* ── Performance ── */
    o = s.taboption('perf', form.Value, 'timeout', _('Upstream query timeout'),
      _('Timeout for outbound DNS queries. Human-readable: 10s, 1m'));
    o.placeholder = '10s'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'timeout'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'timeout', val); };

    o = s.taboption('perf', form.Value, 'rate_limit', _('Rate limit (requests/sec)'),
      _('0 = disabled'));
    o.datatype = 'uinteger'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'rate_limit'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'rate_limit', val); };

    o = s.taboption('perf', form.Value, 'ratelimit_subnet_len_ipv4',
      _('Rate limit subnet length IPv4'),
      _('Clients in the same /N share one rate limit bucket'));
    o.datatype = 'uinteger'; o.placeholder = '24'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'ratelimit_subnet_len_ipv4'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'ratelimit_subnet_len_ipv4', val); };

    o = s.taboption('perf', form.Value, 'ratelimit_subnet_len_ipv6',
      _('Rate limit subnet length IPv6'));
    o.datatype = 'uinteger'; o.placeholder = '56'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'ratelimit_subnet_len_ipv6'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'ratelimit_subnet_len_ipv6', val); };

    o = s.taboption('perf', form.Value, 'udp_buf_size', _('UDP buffer size (bytes)'),
      _('0 = system default'));
    o.datatype = 'uinteger'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'udp_buf_size'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'udp_buf_size', val); };

    o = s.taboption('perf', form.Value, 'max_go_routines', _('Max goroutines'),
      _('0 = unlimited'));
    o.datatype = 'uinteger'; o.rmempty = true;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'max_go_routines'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'max_go_routines', val); };

    o = s.taboption('perf', form.Flag, 'refuse_any', _('Refuse ANY requests'),
      _('Drop DNS queries of type ANY'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'refuse_any'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'refuse_any', val); };

    o = s.taboption('perf', form.Flag, 'pending_requests_enabled',
      _('Deduplicate pending requests'),
      _('One upstream query for identical concurrent requests. Disabling risks cache poisoning.'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'pending_requests_enabled'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'pending_requests_enabled', val); };

    o = s.taboption('perf', form.Flag, 'pprof', _('Enable pprof'),
      _('Expose Go profiling endpoint on localhost:6060'));
    o.rmempty = false;
    o.cfgvalue = function() { return uci.get('dnsproxy', 'global', 'pprof'); };
    o.write    = function(sid, val) { uci.set('dnsproxy', 'global', 'pprof', val); };
  }
});
