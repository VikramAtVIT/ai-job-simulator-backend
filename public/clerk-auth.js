function loadClerkScript(src, publishableKey) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    if (publishableKey) script.dataset.clerkPublishableKey = publishableKey;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load Clerk authentication. Check your connection and try again.'));
    document.head.appendChild(script);
  });
}

async function initializeClerk() {
  const response = await fetch('/api/auth/config');
  if (!response.ok) throw new Error('Unable to load Clerk configuration.');

  const config = await response.json();
  if (!config.configured || !config.publishableKey) return null;

  let clerkDomain;
  try {
    clerkDomain = atob(config.publishableKey.split('_')[2]).slice(0, -1);
  } catch (error) {
    throw new Error('The Clerk publishable key is invalid.');
  }
  if (!clerkDomain) throw new Error('The Clerk publishable key is invalid.');

  await loadClerkScript(`https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await loadClerkScript(
    `https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,
    config.publishableKey
  );

  const clerk = window.Clerk;
  if (!clerk) throw new Error('The Clerk browser SDK did not initialize.');
  await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
  return clerk;
}

window.clerkReady = initializeClerk();
