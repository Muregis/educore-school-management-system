import os

fp = 'src/App.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update setPage
old_setpage = '''  const setPage = useCallback((targetPage) => {
    _setPage(targetPage);
    window.location.hash = #/;
  }, []);'''

new_setpage = '''  const setPage = useCallback((targetPage) => {
    _setPage(targetPage);
    window.location.hash = #/;
    // Silently refetch primary lists on activation
    setDataRefreshRequest(v => v + 1);
  }, []);'''
content = content.replace(old_setpage, new_setpage)

# 2. Update beginTenantRefresh & hydrateTenantData
old_begin = '''  const beginTenantRefresh = useCallback(() => {
    tenantRequestRef.current += 1;
    setDataRefreshRequest((value) => value + 1);
    setTenantDataLoading(true);
    setTenantDataError(null);
    resetClientData();
  }, [resetClientData]);'''

new_begin = '''  const beginTenantRefresh = useCallback((silent = false) => {
    tenantRequestRef.current += 1;
    setDataRefreshRequest((value) => value + 1);
    if (!silent) {
      setTenantDataLoading(true);
      setTenantDataError(null);
      resetClientData();
    }
  }, [resetClientData]);'''
content = content.replace(old_begin, new_begin)

old_hydrate = '''    setTenantDataLoading(true);
    setTenantDataError(null);
    resetClientData();

    const [schoolRes,'''

new_hydrate = '''    const isInitialLoad = tenantRequestRef.current <= 1;
    if (isInitialLoad) {
      setTenantDataLoading(true);
      setTenantDataError(null);
      resetClientData();
    }

    const [schoolRes,'''
content = content.replace(old_hydrate, new_hydrate)

# Update visibility handler to use silent refresh
old_vis = '''  const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        reloadPayments();
        debouncedRefresh();
      }
    };'''

new_vis = '''  const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        debouncedRefresh();
      }
    };'''
content = content.replace(old_vis, new_vis)

old_deb = '''    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (document.visibilityState === "visible") {
          beginTenantRefresh();
        }
      }, 3000);
    };'''

new_deb = '''    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (document.visibilityState === "visible") {
          beginTenantRefresh(true);
        }
      }, 3000);
    };'''
content = content.replace(old_deb, new_deb)


with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("App.jsx hydration updated safely")
