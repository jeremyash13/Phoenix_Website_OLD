export class ProductKeyEmail {

    from: string;
    to: string;
    subject: string;
    html: string; // can insert HTML as a string here

    constructor(customerEmail: string, productKey: string) {
        this.from = `${process.env.PHOENIX_SUPPORT_EMAIL}`;
        this.to = customerEmail;
        this.subject = "Get started with Phoenix!";
        this.html = `<p>TESTING TESTING</p><p>${productKey}</p>`;
    }
}