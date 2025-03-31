require('dotenv').config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 80;

// Enable CORS
app.use(cors());

// Serve static files (like CSS)
app.use(express.static(path.join(__dirname, "public")));

// Replace with your sandbox credentials stored in environment variables
const apiKey = process.env.API_KEY || "Enter Your API Key Here";
const accessToken = process.env.ACCESS_TOKEN || "Enter Your API Access Token here"; // Truncated for brevity

// Serve the initial payment form
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Agaamin Technologies - UPI Payment Page</title>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <div class="page">
            <div class="form">
                <h1>Enter your Payment Details Below</h1>
                <form id="smartNameForm">
                    <label for="smartName">Enter the Smart Name here:</label>
                    <input type="text" id="smartName" name="smartName" required>
                    <button type="submit">Submit</button>
                </form>
                <p id="error-message" style="color: red; display: none;">Invalid UPI ID. Please try again.</p>
            </div>
        </div>
        <script>
            document.getElementById('smartNameForm').addEventListener('submit', async function(event) {
                event.preventDefault();
                const smartName = document.getElementById('smartName').value;
                const url = \`https://hnslogin.world/?name=\${smartName}&type=TXT\`;

                try {
                    const response = await fetch(url);
                    const jsonResponse = await response.json();

                    if (!jsonResponse.Answer) {
                        throw new Error('No DNS answer found for the given Smart Name.');
                    }

                    const upiIdData = jsonResponse.Answer.find(answer => answer.type === 16);
                    
                    if (!upiIdData) {
                        throw new Error('UPI ID not found in DNS records.');
                    }

                    const upiId = upiIdData.data.replace(/"/g, "");
                    const expressServerUrl = window.location.origin;
                    const serverResponse = await fetch(\`\${expressServerUrl}/vpa/\${upiId}\`);
                    const serverResponseData = await serverResponse.json();

                    if (!serverResponseData.nameAtBank || !upiId) {
                        throw new Error('Invalid Smart Name.');
                    }

                    // Redirect to the new page with data in URL parameters
                    const redirectUrl = \`/results?nameAtBank=\${encodeURIComponent(serverResponseData.nameAtBank)}&upiId=\${encodeURIComponent(upiId)}\`;
                    window.location.href = redirectUrl;

                } catch (error) {
                    console.error('Error:', error);
                    document.getElementById('error-message').style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Endpoint to fetch bank name using VPA
app.get("/vpa/:vpa", async (req, res) => {
  const { vpa } = req.params;

  const options = {
    method: "GET",
    url: `https://api.sandbox.co.in/bank/upi/${vpa}`,
    headers: {
      accept: "application/json",
      authorization: accessToken,
      "x-api-key": apiKey,
    },
  };

  try {
    const response = await axios.request(options);
    const nameAtBank = response.data.data.name_at_bank;
    res.status(200).json({ nameAtBank });
  } catch (error) {
    console.error("Error fetching bank details:", error.message);
    res.status(500).json({
      message: "Failed to fetch bank details",
      error: error.response ? error.response.data : error.message,
    });
  }
});

// Serve the results page
app.get("/results", (req, res) => {
  const { nameAtBank, upiId } = req.query;

  res.send(`<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>UPI Payment Result</title>
      <link rel="stylesheet" href="/css/style.css">
  </head>
  <body>
      <div class="page">
          <div class="form">
              <h1>Payment Details</h1>
              <p>Paying to: ${nameAtBank || 'Undefined'}</p>
              <p>UPI ID: ${upiId || 'Undefined'}</p>
              <div class="input-box">
                  <label for="amount">Enter Money Amount</label>
                  <input type="number" id="amount" name="amount" autocomplete="off" min="1" max="100000" required>
              </div>
              <button class="btn" type="button" onclick="proceedWithPayment()">Proceed with the Payment</button>
          </div>
      </div>
      <script>
          // Handle form submission
          function proceedWithPayment() {
              const amount = parseFloat(document.getElementById('amount').value);

              // Validation: Amount must be a number between 1 and 100,000
              if (isNaN(amount) || amount < 1 || amount > 100000) {
                  alert('Please enter a valid amount between 1 and 100,000.');
                  return; // Prevent further execution if the input is invalid
              }

              const transactionId = Math.floor(100000000000 + Math.random() * 900000000000); // Generate 12-digit transaction ID
              const timestamp = new Date().toLocaleString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

              const successUrl = \`/success?amount=\${amount}&payingTo=\${encodeURIComponent('${nameAtBank}')}&upiId=\${encodeURIComponent('${upiId}')}&transactionId=\${transactionId}&timestamp=\${encodeURIComponent(timestamp)}\`;
              window.location.href = successUrl;
          }

          // Handle navigation attempts
          window.addEventListener('popstate', function (event) {
              if (confirm('You are about to go back. Your progress will be lost. Do you want to continue?')) {
                  // Redirect to the first page
                  window.location.href = '/';
              } else {
                  // Prevent navigation
                  history.pushState(null, null, location.href);
              }
          });

          // Add a new state to prevent immediate back navigation
          history.pushState(null, null, location.href);
      </script>
  </body>
  </html>
  `);
});

// Serve the success page
app.get("/success", (req, res) => {
  const { amount, payingTo, upiId, transactionId, timestamp } = req.query;
  res.send(`
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Success</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="page">
        <div class="form">
            <h1>Payment Successful</h1>
            <p class="pay">₹${amount}</p>
            <p>Paid to: ${payingTo}</p>
            <p>UPI ID: ${upiId}</p>
            <p>Transaction ID: ${transactionId}</p>
            <p>Date and Time: ${timestamp}</p>
            <button onclick="goToHome()">Go to Home</button>
        </div>
    </div>
    <script>
        function goToHome() {
            window.location.href = 'https://agaamin.in';
        }

         // Handle navigation attempts
          window.addEventListener('popstate', function (event) {
              if (confirm('You are about to go back. Your progress will be lost. Do you want to continue?')) {
                  // Redirect to the first page
                  window.location.href = '/';
              } else {
                  // Prevent navigation
                  history.pushState(null, null, location.href);
              }
          });

          // Add a new state to prevent immediate back navigation
          history.pushState(null, null, location.href);
    </script>
</body>
</html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
