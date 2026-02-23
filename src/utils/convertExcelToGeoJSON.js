import * as XLSX from "xlsx";

export async function convertExcelToGeoJSON(filePath) {
  const response = await fetch(filePath);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet);

  console.log("First row of Excel data:", data[0]); // Check column names here

  const features = data
    .filter(row => row.LONGITUDE && row.LATITUDE) // adjust name if needed
    .map(row => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          Number(String(row.LONGITUDE).replace(',', '.')), // convert to number
          Number(String(row.LATITUDE).replace(',', '.'))
        ]
      },
      properties: row
    }));

  console.log("Feature count:", features.length); // sanity check

  return {
    type: "FeatureCollection",
    features
  };
}