import os

fp = 'src/App.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

old_ping = '''  useEffect(() => {
    const ping = () => fetch(${API_BASE}/health).catch(() => {});
    ping();
    const interval = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);'''

new_ping = '''  useEffect(() => {
    const ping = async () => {
      try {
        fetch(${API_BASE}/health).catch(() => {});
        // Check for frontend version mismatch (force reload if new build deployed)
        if (typeof __APP_VERSION__ !== "undefined") {
          const res = await fetch(/version.json?t=);
          if (res.ok) {
            const data = await res.json();
            if (data.version && data.version !== __APP_VERSION__) {
              console.warn("New build detected. Reloading...");
              window.location.reload(true);
            }
          }
        }
      } catch (err) {}
    };
    ping();
    const interval = setInterval(ping, 14 * 60 * 1000);
    
    // Also check on visibility change (device wake up)
    const handleVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", handleVis);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, []);'''

content = content.replace(old_ping, new_ping)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated App.jsx ping")
