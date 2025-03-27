require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const moment = require("moment");
const fs = require("fs");
const e = require("express");

const app = express();
app.use(express.json());

const API_KEY = process.env.UNIPLAY_API_KEY;
const API_URL = "https://api-reseller.uniplay.id/v1";
const PINCODE = process.env.UNIPLAY_PINCODE;

// Fungsi untuk membuat UPL-SIGNATURE dengan HMAC-SHA512
function generateSignature(payload) {
  return crypto
    .createHmac("sha512", `${API_KEY}|${payload}`)
    .update(payload)
    .digest("hex");
}

// Fungsi untuk mengirim request ke UniPlay API
async function sendRequest(endpoint, data, token = null) {
  const requestBody = JSON.stringify(data);
  const signature = generateSignature(requestBody);
  const headers = {
    "UPL-SIGNATURE": signature,
    "Content-Type": "application/json",
  };
  if (token) headers["UPL-ACCESS-TOKEN"] = token;

  try {
    const response = await axios.post(`${API_URL}/${endpoint}`, data, {
      headers,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Gagal melakukan request ke ${endpoint}: ${
        error.response?.data || error.message
      }`
    );
  }
}

// Fungsi untuk mendapatkan Access Token
async function getAccessToken() {
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  return sendRequest("access-token", { api_key: API_KEY, timestamp });
}

// Fungsi untuk mendapatkan saldo

// Fungsi untuk menyimpan hasil inquiry DTU ke file JSON
function saveToJSONFile(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

// Fungsi untuk memodifikasi data inquiry-dtu
// Fungsi untuk memodifikasi data inquiry-dtu
// Fungsi untuk memodifikasi data inquiry-dtu dengan kode lebih pendek
function modifyInquiryData(inputFile, outputFile) {
  try {
    // Membaca file JSON asli
    const rawData = fs.readFileSync(inputFile, "utf8");
    const inquiryData = JSON.parse(rawData);

    // Pastikan inquiryData.list_dtu adalah array
    if (!inquiryData || !Array.isArray(inquiryData.list_dtu)) {
      console.error("Data tidak valid atau list_dtu bukan array");
      return;
    }

    // Set untuk menyimpan kode unik
    const kodeSet = new Set();

    // Fungsi untuk membuat inisial dari Nama Game
    function getInitials(name) {
      return name
        .split(" ")
        .map((word) => word[0]) // Ambil huruf pertama dari setiap kata
        .join("")
        .toUpperCase();
    }

    // Struktur data tetap sesuai dengan yang asli
    const modifiedData = {
      status: inquiryData.status,
      message: inquiryData.message,
      list_dtu: inquiryData.list_dtu.map((game) => {
        const gameInitials = getInitials(game.name); // Buat inisial game

        return {
          id: game.id,
          name: game.name,
          denom: game.denom.map((denom) => {
            let baseKode = `${gameInitials}-${denom.package.split(" ")[0]}`;
            let kode = baseKode;
            let counter = 1;

            // Pastikan kode unik dengan menambahkan angka jika sudah ada
            while (kodeSet.has(kode)) {
              kode = `${baseKode}-${counter}`;
              counter++;
            }
            kodeSet.add(kode);

            return {
              id: denom.id,
              package: denom.package,
              price: denom.price,
              kode: kode,
            };
          }),
        };
      }),
    };

    // Simpan hasil ke output file
    fs.writeFileSync(outputFile, JSON.stringify(modifiedData, null, 2));
    console.log(`File berhasil disimpan: ${outputFile}`);
  } catch (error) {
    console.error("Terjadi kesalahan:", error.message);
  }
}

// Endpoint inquiry saldo
app.get("/inquiry-saldo", async (req, res) => {
  try {
    const access_token = (await getAccessToken()).access_token;
    const response = await sendRequest(
      "inquiry-saldo",
      { api_key: API_KEY, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") },
      access_token
    );
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint inquiry DTU
app.get("/inquiry-dtu", async (req, res) => {
  try {
    const access_token = (await getAccessToken()).access_token;
    const response = await sendRequest(
      "inquiry-dtu",
      { api_key: API_KEY, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") },
      access_token
    );
    saveToJSONFile("inquiry-dtu.json", response);
    // modifyInquiryData("inquiry-dtu.json", "modified-inquiry-dtu.json");
    res.json(response);
    console.log("File berhasil disimpan: inquiry-dtu.json");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint untuk memodifikasi dan menyimpan data inquiry-dtu
app.get("/modify-inquiry-dtu", async (req, res) => {
  try {
    const inputFile = "inquiry-dtu.json";
    const outputFile = "modified-inquiry-dtu.json";
    modifyInquiryData(inputFile, outputFile);
    res.json({ message: "Data berhasil dimodifikasi dan disimpan." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint generate code
app.get("/generate-code", async (req, res) => {
  try {
    const access_token = (await getAccessToken()).access_token;
    const response = await sendRequest(
      "inquiry-dtu",
      { api_key: API_KEY, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") },
      access_token
    );

    // Simpan hasil inquiry DTU
    saveToJSONFile("inquiry-dtu.json", response);

    setTimeout(() => {
      const inputFile = "inquiry-dtu.json";
      const outputFile = "generate-code.json";
      modifyInquiryData(inputFile, outputFile);

      // Baca kembali file hasil modifikasi
      const modifiedData = JSON.parse(fs.readFileSync(outputFile, "utf8"));

      // Dictionary untuk pencarian cepat kode berdasarkan id denom
      const kodeDictionary = {};
      modifiedData.list_dtu.forEach((game) => {
        game.denom.forEach((denom) => {
          kodeDictionary[denom.id] = denom.kode;
        });
      });

      // Mulai membangun HTML
      let html = `
        <html>
        <head>
          <title>Generate Code</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h2 { background-color: #008CBA; color: white; padding: 10px; }
            button { cursor: pointer; background-color: #008CBA; color: white; border: none; padding: 5px; }
          </style>
          <script>
            function copyText(text) {
              navigator.clipboard.writeText(text);
              alert('Copied: ' + text);
            }
          </script>
        </head>
        <body>
          <h1>Generate Code List</h1>`;

      // Loop untuk membuat tabel per Nama Game
      response.list_dtu.forEach((game) => {
        html += `<h2>${game.name}</h2>
        <table>
          <tr>
            <th>Kode</th>
            <th>Copy</th>
            <th>Package</th>
            <th>Harga</th>
            <th>ID Denom</th>
          </tr>`;

        game.denom.forEach((denom) => {
          const kode = kodeDictionary[denom.id] || "";
          html += `
            <tr>
              <td>${kode}</td>
              <td><button onclick="copyText('${kode}')">📋</button></td>
              <td>${denom.package}</td>
              <td>Rp ${denom.price}</td>
              <td>${denom.id}</td>
            </tr>`;
        });

        html += `</table>`;
      });

      html += `</body></html>`;

      res.send(html);
    }, 1000); // Delay 1 detik untuk memastikan penyimpanan selesai
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////

async function getSaldo() {
  const access_token = (await getAccessToken()).access_token;
  const saldoResponse = await sendRequest(
    "inquiry-saldo",
    { api_key: API_KEY, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") },
    access_token
  );
  return saldoResponse?.saldo || "Saldo tidak tersedia";
}

function getEntitasAndDenom(kode) {
  const data = JSON.parse(fs.readFileSync("generate-code.json", "utf8"));
  for (const game of data.list_dtu) {
    for (const denom of game.denom) {
      if (denom.kode === kode)
        return { entitas_id: game.id, denom_id: denom.id };
    }
  }
  return { entitas_id: null, denom_id: null };
}

async function processInquiryPayment(entitas_id, denom_id, user_id, server_id) {
  return await sendRequest(
    "inquiry-payment",
    {
      api_key: API_KEY,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      entitas_id,
      denom_id,
      user_id,
      server_id,
    },
    (
      await getAccessToken()
    ).access_token
  );
}

async function processConfirmPayment(inquiry_id) {
  return await sendRequest(
    "confirm-payment",
    {
      api_key: API_KEY,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      inquiry_id,
      pincode: PINCODE,
    },
    (
      await getAccessToken()
    ).access_token
  );
}

/////////////////////////////////////////////////////////////////////////////////////////////

// Simpan transaksi yang sudah diproses
const cacheFile = "transactionCache.json";

// Fungsi untuk menyimpan cache ke file JSON
function saveCacheToFile() {
  fs.writeFileSync(cacheFile, JSON.stringify(transactionCache, null, 2));
}

// Fungsi untuk memuat cache dari file JSON saat aplikasi dimulai
function loadCacheFromFile() {
  if (fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }
  return {};
}
// Inisialisasi transactionCache dari file JSON
let transactionCache = loadCacheFromFile();

/////////////////////////////////////////////////////////////////////////////////////////////

// Endpoint topup
app.get("/topup", async (req, res) => {
  console.log("Menerima Transaksi...");
  try {
    const { kode, ID_TRX } = req.query;
    let { user_id, server_id } = req.query;
    if (transactionCache[ID_TRX])
      return (
        res.json(transactionCache[ID_TRX]),
        console.log("ID_TRX ", ID_TRX, " sudah ada di cache")
      );

    if (kode.startsWith("MLBB")) {
      server_id = user_id.slice(9);
      user_id = user_id.slice(0, 9);
    }

    const { entitas_id, denom_id } = getEntitasAndDenom(kode);
    if (!entitas_id || !denom_id)
      return res.status(400).json({ error: "Kode tidak ditemukan" });

    const inquiryResponse = await processInquiryPayment(
      entitas_id,
      denom_id,
      user_id,
      server_id
    );
    if (inquiryResponse.status !== "200")
      return res
        .status(400)
        .json({ error: "Inquiry payment failed", details: inquiryResponse });

    const confirmResponse = await processConfirmPayment(
      inquiryResponse.inquiry_id
    );

    const saldo = await getSaldo();
    const usernameGame = inquiryResponse?.inquiry_info.username;
    const trxItem = confirmResponse?.order_info.trx_item;
    const snGame = usernameGame + " / " + trxItem;

    const responsePayload = {
      ID_TRX,
      ...confirmResponse,
      serialNumber: snGame,
      saldo,
    };
    transactionCache[ID_TRX] = responsePayload;
    saveCacheToFile();

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////
// Endpoint INQUIRY Payment
app.get("/inquiry-payment", async (req, res) => {
  console.log("Menerima IQUERY payment...!");

  try {
    const { kode, ID_TRX } = req.query;
    let { user_id, server_id } = req.query;
    if (transactionCache[ID_TRX])
      return (
        res.json(transactionCache[ID_TRX]),
        console.log("ID_TRX ", ID_TRX, " sudah ada di cache")
      );

    if (kode.startsWith("MLBB")) {
      server_id = user_id.slice(9);
      user_id = user_id.slice(0, 9);
    }
    // console.log("user_id", user_id, "server_id", server_id);

    const { entitas_id, denom_id } = getEntitasAndDenom(kode);
    if (!entitas_id || !denom_id)
      return res.status(400).json({ error: "Kode tidak ditemukan" });

    const inquiryResponse = await processInquiryPayment(
      entitas_id,
      denom_id,
      user_id,
      server_id
    );
    if (inquiryResponse.status !== "200")
      return res
        .status(400)
        .json({ error: "Inquiry payment failed", details: inquiryResponse });

    // console.log("Inquiry Response:", JSON.stringify(inquiryResponse, null, 2));

    const saldo = await getSaldo();
    const usernameGame = inquiryResponse?.inquiry_info?.username || "Unknown";
    const responseInqload = {
      ID_TRX,
      ...inquiryResponse,
      usernameGame,
      saldo,
    };
    transactionCache[ID_TRX] = responseInqload;
    saveCacheToFile();

    res.json(responseInqload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/////////////////////////////////////////////////////////////////////////////////////////////

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
