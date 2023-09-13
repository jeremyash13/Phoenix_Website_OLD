import Stripe from "stripe";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Customer } from "./types/Customer";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

let stripeApiKey;

export const stripeCheckout = onRequest(
  { secrets: ["STRIPE_PRIVATE_KEY_PROD"] },
  async (request, response) => {
    if (process.env.STRIPE_PRIVATE_KEY_DEV) {
      stripeApiKey = process.env.STRIPE_PRIVATE_KEY_DEV;
    } else {
      stripeApiKey = process.env.STRIPE_PRIVATE_KEY;
    }

    const stripe = new Stripe(`${stripeApiKey}`, { apiVersion: "2023-08-16" });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: `${process.env.PHOENIX_PRICE_ID}`,
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_creation: "always",
      success_url: `${process.env.SITE_DOMAIN}/success.html`,
      cancel_url: `${process.env.SITE_DOMAIN}/cancel.html`,
    });

    logger.info("stripe checkout session initiated", { structuredData: true });
    response.redirect(303, `${session.url}`);
  }
);

export const webhooks = onRequest(async (request, response) => {
  const event = request.body;

  logger.info(`${event.type}`, { structuredData: true });
  console.log(event.type);

  switch (event.type) {
    case "checkout.session.completed":
      const checkoutSession = event.data.object;
      await handleCheckoutSucceeded(checkoutSession);
      break;
    // ... handle other event types
    default:
      logger.info(`Unhandled event type ${event.type}`, {
        structuredData: true,
      });
  }

  response.status(200).send();

  async function handleCheckoutSucceeded(
    checkoutSession: Stripe.Checkout.Session
  ): Promise<void> {
    let customer = new Customer(checkoutSession);

    // convert Customer custom type to generic object for firestore entry
    let customerAsDoc = {};
    let newDoc = Object.assign(customerAsDoc, customer);
    // console.log(newDoc)

    newDoc.product_key = await generateProductKey();
    newDoc.timestamp = Timestamp.fromDate(new Date());

    // email receipt to customer
    // email product key to customer

    try {
      const docRef = await db.collection("customers").add(newDoc);
      console.log("Document written with ID: ", docRef.id);
      return;
    } catch (e) {
      console.error("Error adding document: ", e);
      return;
    }
  }

  async function generateProductKey(): Promise<any> {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const timestamp = new Date().getTime().toString(36).toUpperCase(); // Convert current time to base36 and uppercase
    const maxKeyLength = 16;

    let randomString = "";
    let timeSeedIndex = 0;

    try {
      for (let i = 0; i < maxKeyLength; i++) {
        if (timeSeedIndex < timestamp.length) {
          randomString += timestamp[timeSeedIndex];
          timeSeedIndex++;
        } else {
          // If we run out of time seed characters, use random characters
          const randomIndex = Math.floor(Math.random() * characters.length);
          randomString += characters[randomIndex];
        }

        if ((i + 1) % 4 === 0 && i !== 15) {
          // Add a hyphen after every 4th character (except at the end)
          randomString += "-";
        }
      }

      let isCollision = await checkCollision(randomString);

      if (isCollision) {
        return await generateProductKey();
      } else {
        return randomString;
      }
    } catch (error) {
      console.error("error generating product key:", error);
    }
  }

  async function checkCollision(productKey: string): Promise<boolean> {
    try {
      const customersRef = await db.collection("customers");
      const snapshot = await customersRef
        .where("product_key", "==", productKey)
        .get();
      if (snapshot.empty) {
        console.log(
          "Product Key Collision Check: No Collision detected. Proceeding... "
        );
        return false;
      } else {
        console.log(
          "Product Key Collision Check: Collision detected. Generating new product key..."
        );
        return true;
      }
    } catch (error) {
      console.error("error checking for product key collision:", error);
      return true; // returning true to generate a new key and try again...
    }
  }
});
