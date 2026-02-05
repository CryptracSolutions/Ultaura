describe('Reminders mobile behavior', () => {
  it('keeps message input at 16px on mobile and opens the action sheet without large scroll jumps', () => {
    cy.viewport('iphone-x');
    cy.signIn('/dashboard/reminders');

    const reminderMessage = `Mobile reminder ${Date.now()}`;

    cy.scrollTo('bottom');
    cy.window().its('scrollY').as('beforeOpenScrollY');

    cy.contains('button', 'Set Reminder').click();

    cy.get('body').then(($body) => {
      const linePickerButtons = $body.find('[role="dialog"] [data-autofocus]');

      if (linePickerButtons.length > 0) {
        cy.wrap(linePickerButtons[0]).click();
      }
    });

    cy.get('#reminder-message').should('be.visible');

    cy.window().its('scrollY').then((afterOpenScrollY) => {
      cy.get('@beforeOpenScrollY').then((beforeOpenScrollY) => {
        expect(Math.abs(afterOpenScrollY - Number(beforeOpenScrollY))).to.be.lessThan(180);
      });
    });

    cy.get('#reminder-message').should('have.css', 'font-size', '16px');

    cy.get('#reminder-message').then(($textarea) => {
      const beforeFocusTop = $textarea[0].getBoundingClientRect().top;

      cy.window().its('scrollY').then((beforeFocusScrollY) => {
        cy.wrap($textarea).click().should('be.focused');

        cy.window().its('scrollY').then((afterFocusScrollY) => {
          expect(Math.abs(afterFocusScrollY - Number(beforeFocusScrollY))).to.be.lessThan(100);
        });

        cy.get('#reminder-message').then(($focusedTextarea) => {
          const afterFocusTop = $focusedTextarea[0].getBoundingClientRect().top;
          expect(Math.abs(afterFocusTop - beforeFocusTop)).to.be.lessThan(40);
        });
      });
    });

    cy.get('#reminder-message').clear().type(reminderMessage);
    cy.contains('button', 'Select date').click();
    cy.contains('button', 'Select today').click();
    cy.contains('button', 'Save Reminder').click();

    cy.contains('p', reminderMessage)
      .should('be.visible')
      .parents('div')
      .filter(':has(button)')
      .first()
      .within(() => {
        cy.get('button').first().click();
      });

    cy.contains('button', 'Edit').should('be.visible');
    cy.contains('button', 'Cancel').should('be.visible');
  });
});
