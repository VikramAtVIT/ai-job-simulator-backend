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

window.clerkAppearance = {
  variables: {
    colorPrimary: '#7c6cff',
    colorBackground: '#111630',
    colorText: '#f6f7ff',
    colorTextSecondary: '#aab1d0',
    colorInputBackground: 'rgba(255, 255, 255, 0.06)',
    colorInputText: '#f6f7ff',
    colorNeutral: '#aab1d0',
    colorDanger: '#fb7185',
    borderRadius: '12px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  elements: {
    rootBox: 'clerk-root-box',
    cardBox: 'clerk-card-box',
    card: 'clerk-card',
    headerTitle: 'clerk-header-title',
    headerSubtitle: 'clerk-header-subtitle',
    socialButtonsBlockButton: 'clerk-social-button',
    formFieldLabel: 'clerk-form-label',
    formFieldInput: 'clerk-form-input',
    formButtonPrimary: 'clerk-form-submit',
    footerActionLink: 'clerk-footer-link',
    dividerLine: 'clerk-divider-line',
    dividerText: 'clerk-divider-text',
    footer: 'clerk-footer'
  },
  options: {
    socialButtonsVariant: 'blockButton',
    socialButtonsPlacement: 'top',
    showOptionalFields: false
  }
};
