import { themingPo } from '../support/theming.po';

describe(`Theming`, () => {
  describe('When the OS theme is dark', () => {
    it('should use dark mode', () => {
      themingPo.visitWithSystemTheme('/', true);
      themingPo.assertIsDark();
    });
  });

  describe('When the OS theme is light', () => {
    it('should use light mode', () => {
      themingPo.visitWithSystemTheme('/', false);
      themingPo.assertIsLight();
    });
  });

  describe('When the OS theme changes', () => {
    it('should switch automatically', () => {
      themingPo.visitWithSystemTheme('/', false);
      themingPo.assertIsLight();

      // Prove meta theme-color changes too.
      cy.get("meta[name='theme-color']")
        .invoke('attr', 'content')
        .then((lightMeta) => {
          themingPo.setSystemTheme(true);
          themingPo.assertIsDark();

          cy.get("meta[name='theme-color']")
            .invoke('attr', 'content')
            .should((darkMeta) => {
              expect(darkMeta).to.not.equal(lightMeta);
            });
        });

      themingPo.setSystemTheme(false);
      themingPo.assertIsLight();
    });
  });

  describe('Across routes', () => {
    it('should stay in sync with the OS theme', () => {
      themingPo.visitWithSystemTheme('/auth/sign-in', true);
      themingPo.assertIsDark();
    });
  });
});
