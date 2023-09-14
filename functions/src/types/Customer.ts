import { Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";

export class Customer {
    stripe_customer_id: string | null;
    name: string | null;
    email: string;
    phone: string | null;
    tax_exempt: string | null;
    product_key: string | null;
    address: {
        city: string | null;
        country: string | null,
        line1: string | null,
        line2: string | null,
        postal_code: string | null,
        state: string | null,
    };
    hardware_ids: [];
    timestamp: Timestamp | null;

    constructor(checkoutSession: Stripe.Checkout.Session){
        this.stripe_customer_id = checkoutSession.customer ? checkoutSession.customer.toString() : null;
        this.name = checkoutSession.customer_details?.name ? checkoutSession.customer_details.name: null;
        this.email = checkoutSession.customer_details?.email ? checkoutSession.customer_details.email: "";
        this.phone = checkoutSession.customer_details?.phone ? checkoutSession.customer_details.phone: null;
        this.tax_exempt = checkoutSession.customer_details?.tax_exempt ? checkoutSession.customer_details.tax_exempt: null;
        this.address = {
            city: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.city : null,
            country: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.country : null,
            line1: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.line1 : null,
            line2: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.line2 : null,
            postal_code: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.postal_code : null,
            state: checkoutSession.customer_details?.address ? checkoutSession.customer_details.address.state : null,
        };
        this.product_key = null;
        this.hardware_ids = [];
        this.timestamp = null;
    }
}