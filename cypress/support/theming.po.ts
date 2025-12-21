export namespace themingPo {
  export function visitWithSystemTheme(path: string, isDark: boolean) {
    cy.visit(path, {
      onBeforeLoad(win) {
        stubMatchMedia(win, isDark);
      },
    });
  }

  export function setSystemTheme(isDark: boolean) {
    cy.window().then((win) => {
      (win as any).__setSystemTheme?.(isDark);
    });
  }

  export function assertIsDark() {
    cy.get('html').should('have.class', 'dark');
  }

  export function assertIsLight() {
    cy.get('html').should('not.have.class', 'dark');
  }
}

function stubMatchMedia(win: Window, initialIsDark: boolean) {
  let isDark = initialIsDark;
  const listeners = new Set<(event: { matches: boolean; media: string }) => void>();

  // Keep the API surface compatible with both addEventListener('change') and addListener.
  (win as any).matchMedia = (query: string) => {
    const mql = {
      media: query,
      get matches() {
        return isDark;
      },
      onchange: null as null | ((event: any) => void),
      addEventListener: (event: string, cb: any) => {
        if (event === 'change') {
          listeners.add(cb);
        }
      },
      removeEventListener: (event: string, cb: any) => {
        if (event === 'change') {
          listeners.delete(cb);
        }
      },
      addListener: (cb: any) => {
        listeners.add(cb);
      },
      removeListener: (cb: any) => {
        listeners.delete(cb);
      },
      dispatchEvent: () => true,
    };

    return mql;
  };

  (win as any).__setSystemTheme = (nextIsDark: boolean) => {
    isDark = nextIsDark;
    listeners.forEach((cb) =>
      cb({ matches: isDark, media: '(prefers-color-scheme: dark)' })
    );
  };
}
