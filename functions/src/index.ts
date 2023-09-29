import Stripe from "stripe";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Customer } from "./types/Customer";
import { ProductKeyEmail } from "./services/email/ProductKeyEmail";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
import { getStorage, getDownloadURL } from "firebase-admin/storage";
// import { listAll, ref, getStream, StorageReference, getDownloadURL, getStorage } from "firebase/storage";

const nodemailer = require("nodemailer");

initializeApp({
  storageBucket: "phoenix-74ffa.appspot.com"
});
const db = getFirestore();
const storage = getStorage();

let stripeApiKey;

// function testEmail(username: string, password: string) {
//   let transport = nodemailer.createTransport({
//     host: "smtppro.zoho.com",
//     port: 587,
//     auth: {
//       user: username,
//       pass: password,
//     },
//   });

//   let email = new ProductKeyEmail("jeremyash13@gmail.com", "newDoc.product_key");

//   transport.sendMail(email, (error: any, info: any) => {
//     if (error) {
//       console.log("Error sending email:", error);
//     } else {
//       console.log("Email sent successfully");
//     }
//   });
// }

export const stripeCheckout = onRequest(
  { secrets: ["STRIPE_PRIVATE_KEY_PROD", "ZOHO_MAIL_USERNAME", "ZOHO_MAIL_PASSWORD"] },
  async (request, response) => {
    if (process.env.STRIPE_PRIVATE_KEY_DEV) {
      stripeApiKey = process.env.STRIPE_PRIVATE_KEY_DEV;
    } else {
      stripeApiKey = process.env.STRIPE_PRIVATE_KEY_PROD;
    }

    // testEmail(`${process.env.ZOHO_MAIL_USERNAME}`, `${process.env.ZOHO_MAIL_PASSWORD}`); //////////////////////////// FOR DEBUGGING

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

export const webhooks = onRequest(
  { secrets: ["MAILTRAP_API_PASSWORD", "ZOHO_MAIL_USERNAME", "ZOHO_MAIL_PASSWORD"] },
  async (request, response) => {
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

      let transport = nodemailer.createTransport({
        host: "smtppro.zoho.com",
        port: 587,
        auth: {
          user: process.env.ZOHO_MAIL_USERNAME,
          pass: process.env.ZOHO_MAIL_PASSWORD,
        },
      });

      // convert Customer custom type to generic object for firestore entry
      let customerAsDoc = {};
      let newDoc = Object.assign(customerAsDoc, customer);
      // console.log(newDoc)

      newDoc.product_key = await generateProductKey();
      newDoc.timestamp = Timestamp.fromDate(new Date());

      let email = new ProductKeyEmail(customer.email, newDoc.product_key);

      try {
        const docRef = await db.collection("customers").add(newDoc);
        console.log("Document written with ID: ", docRef.id);

        // email product key to customer
        transport.sendMail(email, (error: any, info: any) => {
          if (error) {
            console.log("Error sending email:", error);
          } else {
            console.log("Email sent successfully");
          }
        });

        return;
      } catch (e) {
        console.error("Error adding document: ", e);
        return;
      }
    }

    async function generateProductKey(): Promise<string> {
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
        }
      } catch (error) {
        console.error("error generating product key:", error);
      }

      const promise = new Promise<string>((resolve) => resolve(randomString));
      return promise;
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
  }
);

export const activate = onRequest(async (request, response) => {
  
  const data = JSON.parse(request.body);
  console.log(data);

  const { productKey, HWID } = data;

  try {
    const customersCollection = await db.collection("customers");

    const snapshot = await customersCollection.where('product_key', '==', productKey).get();

    if (snapshot.empty) {
      console.log('Error while validating product key: No matching documents.');
      response.status(200).send({validation: "failed"});
      return;
    }

    snapshot.forEach(async (doc: any) => {
      // console.log(doc.data());
      const hwids_array = doc.data().hardware_ids;
      
      if (hwids_array.length > 4) {
        // Deactivated oldest machine if HWID's exceed 5
        await doc.ref.update({hardware_ids: FieldValue.arrayRemove(hwids_array[0])})
      }
      
      // append HWID in current document
      await doc.ref.update({hardware_ids: FieldValue.arrayUnion(HWID)})
      console.log("Software activation succeeded. Doc ID: ", doc.ref.id);
    });

  } catch (error) {
    console.error('Error while validating product key:', error);
    response.status(200).send({validation: "failed", message: request});
  }

  response.status(200).send({validation: "success"});
});

export const validate = onRequest(async (request, response) => {
  
  const data = JSON.parse(request.body);
  console.log(data);

  const { productKey, HWID } = data;

  try {
    const customersCollection = await db.collection("customers");

    const snapshot = await customersCollection.where('product_key', '==', productKey).get();

    if (snapshot.empty) {
      console.log('Error while validating product key: No matching documents.');
      response.status(200).send({validation: "failed"});
      return;
    }

    let result: boolean = true;

    snapshot.forEach((doc: any) => {
      // console.log(doc.data());
      result = doc.data().hardware_ids.includes(HWID);
    });

    if (result) {
      console.log("validation successfull");
      response.status(200).send({validation: "success"});
      return;
    }
    
  } catch (error) {
    console.error('Error while silently validating an installation:', error);
    response.status(500).send({validation: "error", message: error});
    return;
  }

  response.status(200).send({validation: "failed"});
});

export const downloadlatest = onRequest(async (request, response) => {
  
  // const data = JSON.parse(request.body);
  // console.log(data);

  // let latestPackageRef: StorageReference;
  // let latestPackageStream;
  // let latestPackageStream: NodeJS.ReadableStream;


  try {

    const fileRef = getStorage().bucket().file('releases/latest/Phoenix_0.9.1.0_x64.msix');
    const downloadURL= await getDownloadURL(fileRef);
    response.redirect(303, downloadURL);






    // await latestPackageStream
    //   .on('data', (chunk) => {
    //     // The file download is complete
    //     response.write(chunk);
    //   })
    //   .on('finish', () => {
    //     // The file download is complete
    //     response.status(200).end();
    //   })
    //   .on('error', () => {
    //     // The file download is complete
    //     response.status(500).end();
    //   });





    // const releasesRef = ref(storage, 'releases/latest');

    // listAll(releasesRef)
    //   .then((res) => {
    //     res.items.forEach(async (itemRef) => {
    //       // All the items under listRef.
    //       console.log(itemRef.name);
    //       // const downloadURL = await getDownloadURL(itemRef);
    //       // response.redirect(303, downloadURL);
    //     });    
    //   })
      // .then(async () => {
      //   // latestPackageStream = getStream(latestPackageRef);

      //   // latestPackageStream.on('data', (chunk) => {
      //   //   // Write each chunk of data to the response
      //   //   response.write(chunk);
      //   // });

      //   // latestPackageStream.on('error', () => {
      //   //   // End the response when there are no more chunks
      //   // response.status(500).end();
      //   // });

      //   // latestPackageStream.on('end', () => {
      //   //   // End the response when there are no more chunks
      //   // response.status(200).end();
      //   // });
      // });


  } catch (error) {
    console.error('Error occurred at /downloadlatest:', error);
    response.status(500).end();
    return;
  }

});