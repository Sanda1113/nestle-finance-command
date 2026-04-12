describe('Supplier Dashboard', () => {
    beforeEach(() => {
        cy.visit('/');
        // Mock login or use test credentials
    });

    it('should display shipments tab', () => {
        cy.contains('📥 Shipments').click();
        cy.contains('Active Shipments').should('be.visible');
    });

    it('should allow BOQ upload', () => {
        cy.contains('📑 1. Submit Quote').click();
        cy.get('input[type="file"]').attachFile('sample-boq.pdf');
        cy.contains('Submit Quote').click();
        cy.contains('Sent to Procurement Team').should('be.visible');
    });
});