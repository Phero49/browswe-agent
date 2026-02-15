import type{ OpenedTabs } from './../../../../types.d';



export async function getOpenedTabs():Promise<OpenedTabs[]> {
  const allTabs = await chrome.tabs.query({});
  const tabs: {
    index: number;
    id: number | undefined;
    windowId: number;
    url: string;
    title: string | undefined;
  }[] = [];

  allTabs.forEach((tab) => {
    if (tab.url == undefined) {
      return;
    }
    // Skip chrome:// tabs
    if (!tab.url.startsWith('chrome://')) {
      tabs.push({
        index: tab.index,
        id: tab.id,
        windowId: tab.windowId,
        url: tab.url,
        title: tab.title,
      });
    }
  });

  return tabs;
}
