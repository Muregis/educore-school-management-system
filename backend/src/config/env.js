import dotenv from "dotenv";
dotenv.config();

export const env = {
  port:                 Number(process.env.PORT || 4000),
  dbHost:               process.env.DB_HOST      || "127.0.0.1",
  dbPort:               Number(process.env.DB_PORT || 3307),
  dbUser:               process.env.DB_USER      || "root",
  dbPassword:           process.env.DB_PASSWORD  || "0101",
  dbName:               process.env.DB_NAME      || "educore_db",
  jwtSecret:            process.env.JWT_SECRET   || "educore_dev_secret_change_me",
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin:           process.env.CORS_ORIGIN  || "http://localhost:5173",

  // Mpesa Daraja
  mpesaConsumerKey:     process.env.MPESA_CONSUMER_KEY     || "",
  mpesaConsumerSecret:  process.env.MPESA_CONSUMER_SECRET  || "",
  mpesaShortcode:       process.env.MPESA_SHORTCODE        || "174379",
  mpesaPasskey:         process.env.MPESA_PASSKEY          || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
  mpesaBaseUrl:         process.env.MPESA_BASE_URL         || "https://sandbox.safaricom.co.ke",
  mpesaCallbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL || "https://your-ngrok-url.ngrok.io",

  // Paystack
  paystackSecretKey:    process.env.PAYSTACK_SECRET_KEY    || "sk_test_a4fa82fd12af8908730545b08ba6ca2aae2d676a",
  paystackPublicKey:    process.env.PAYSTACK_PUBLIC_KEY    || "pk_test_9284bb0b29fd15641b6f9f3a01aba134c563ebb0",
  paystackCallbackUrl:  process.env.PAYSTACK_CALLBACK_URL  || "http://localhost:5173",

  // Africa's Talking
  atApiKey:             process.env.AT_API_KEY    || "atsk_e6126188f3be2fe6bea26d00b0cae479739c3ed752e10216dd79b030c9acf24225b1f983",
  atUsername:           process.env.AT_USERNAME   || "sandbox",
  atSenderId:           process.env.AT_SENDER_ID  || "EduCore",
};