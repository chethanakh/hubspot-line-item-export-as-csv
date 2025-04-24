const axios = require('axios');
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const HUBSPOT_BASE = 'https://api.hubapi.com';
const LINE_ITEM_PROPS = [
  'name',
  'amount',
  'price',
  'quantity',
  'hs_product_id',
  'createdate',
  'hs_lastmodifieddate',
];

const hsGet = (path, token, params = {}) =>
  axios.get(`${HUBSPOT_BASE}${path}`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });

const hsPost = (path, token, data = {}) =>
  axios.post(`${HUBSPOT_BASE}${path}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });

const chunkArray = (arr, size) =>
  arr.reduce(
    (out, cur, i) => (i % size ? (out[out.length - 1].push(cur), out) : [...out, [cur]]),
    []
  );

const delay = (ms) => new Promise((res) => setTimeout(res, ms));


async function getLineItemIdsForDeal(dealId, privateAppKey) {
  const { data } = await hsGet(
    `/crm/v4/objects/deals/${dealId}/associations/line_items`,
    privateAppKey,
    { limit: 100 }
  );
  return data.results.map((a) => a.toObjectId);
}


async function batchReadLineItems(ids, privateAppKey) {
  const chunks = chunkArray(ids, 100);
  const lineItems = [];

  await Promise.all(
    chunks.map(async (chunk) => {
      const { data } = await hsPost(
        '/crm/v3/objects/line_items/batch/read',
        privateAppKey,
        {
          properties: LINE_ITEM_PROPS,
          inputs: chunk.map((id) => ({ id })),
        }
      );

      data.results.forEach((li) =>
        lineItems.push({
          id: li.id,
          name: li.properties.name,
          amount: Number(li.properties.amount),
          price: Number(li.properties.price),
          quantity: Number(li.properties.quantity),
          productId: li.properties.hs_product_id,
          createdAt: li.properties.createdate,
          updatedAt: li.properties.hs_lastmodifieddate,
        })
      );
    })
  );

  return lineItems;
}

function generateCsv(data, filename) {
  if (data.length < 1) {
    throw "csv should need to have atleast one row";
  }
  csvRows = [];
  csvRows.push(LINE_ITEM_PROPS.join(","));


  data.forEach((properties) => {
    const values = Object.values(properties).join(",");
    csvRows.push(values);
  });
  csvRows = csvRows.join("\n");

  const csvContent = csvRows;
  const filePath = path.join("/tmp", filename);
  fs.writeFileSync(filePath, csvContent, "utf8");
  return filePath;
}

async function uploadFileToHubSpot(fileContent, folderId, privateAppKey) {
  let data = new FormData();
  data.append("file", fileContent);
  data.append("options", '{"access": "PRIVATE", "ttl": "P1D"}');
  data.append("folderId", folderId);

  const response = await axios.request({
    method: "post",
    maxBodyLength: Infinity,
    url: `${HUBSPOT_BASE}/files/v3/files`,
    headers: {
      Authorization: `Bearer ${privateAppKey}`,
      ...data.getHeaders(),
    },
    data: data,
  });
  return response.data;
}

async function getSignedURL({ id }, expirationSeconds, privateAppKey) {
  const response = await axios.get(
    `${HUBSPOT_BASE}/files/v3/files/${id}/signed-url?expirationSeconds=${expirationSeconds}`,
    {
      headers: {
        Authorization: `Bearer ${privateAppKey}`,
      },
    },
  );

  return response.data;
}

module.exports.main = async (context = {}) => {
  const privateAppKey = process.env.PRIVATE_APP_ACCESS_TOKEN;
  const folderId = process.env.HUBSPOT_LINE_ITEM_FOLDER_ID;
  const expirationSeconds = process.env.HUBSPOT_SINGED_URL_EXP_AT;
  let dealId = context.propertiesToSend.hs_object_id;
  let dealname = context.propertiesToSend.dealname;

  const filename = dealname + "-line-items-" + new Date().getTime() + ".csv";


  if (!dealId) throw new Error('HubSpot Deal Id is missing.');


  const lineItemIds = await getLineItemIdsForDeal(dealId, privateAppKey);

  if (lineItemIds.length === 0) return { lineItems: [] };

  const lineItems = await batchReadLineItems(lineItemIds, privateAppKey);

  var filePath = generateCsv(lineItems, filename);
  const fileContent = fs.createReadStream(filePath);
  const uploadRes = await uploadFileToHubSpot(fileContent, folderId, privateAppKey);
  const { url } = await getSignedURL(uploadRes, expirationSeconds, privateAppKey);


  return { downloadLink: url };
};
