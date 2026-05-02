const SHEET_NAME = 'Transactions';
const MASTER_SHEET_NAME = 'Master';
const REMINDERS_SHEET_NAME = 'Reminders';
const FOLDER_NAME = 'Bukti Transaksi FinansialKu';

// Fungsi ini dijalankan pertama kali untuk membuat sheet jika belum ada
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Setup Transactions
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Tanggal', 'Tipe', 'Output', 'Nominal', 'Metode Pembayaran', 'Sumber Dana', 'Keterangan', 'Bukti Transaksi (URL)', 'Reminder', 'Recurrence']);
    sheet.getRange("A1:K1").setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    var range = sheet.getRange("A1:K1");
    range.setValues([['ID', 'Tanggal', 'Tipe', 'Output', 'Nominal', 'Metode Pembayaran', 'Sumber Dana', 'Keterangan', 'Bukti Transaksi (URL)', 'Reminder', 'Recurrence']]);
    range.setFontWeight("bold");
  }

  // Setup Reminders (Separate Sheet)
  var reminderSheet = ss.getSheetByName(REMINDERS_SHEET_NAME);
  if (!reminderSheet) {
    reminderSheet = ss.insertSheet(REMINDERS_SHEET_NAME);
    reminderSheet.appendRow(['ID', 'Tanggal Dibuat', 'Pesan', 'Waktu Pengingat', 'Pengulangan']);
    reminderSheet.getRange("A1:E1").setFontWeight("bold");
    reminderSheet.setFrozenRows(1);
  }
  
  // Setup Master
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!masterSheet) {
    masterSheet = ss.insertSheet(MASTER_SHEET_NAME);
    masterSheet.appendRow(['Daftar Output', 'Metode Pembayaran', 'Sumber Dana']);
    masterSheet.getRange("A1:C1").setFontWeight("bold");
    masterSheet.setFrozenRows(1);
  }
}

// Fungsi GET untuk membaca data
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  var reminderSheet = ss.getSheetByName(REMINDERS_SHEET_NAME);
  
  if (!sheet || !masterSheet || !reminderSheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
    masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
    reminderSheet = ss.getSheetByName(REMINDERS_SHEET_NAME);
  }
  
  // Read Transactions
  var txData = sheet.getDataRange().getValues();
  var transactions = [];
  for (var i = 1; i < txData.length; i++) {
    var row = txData[i];
    if (row[0] !== '') {
      transactions.push({
        id: row[0],
        date: formatDateStr(row[1]),
        type: row[2],
        output: row[3],
        amount: Number(row[4]),
        paymentMethod: row[5],
        fundSource: row[6],
        description: row[7],
        receiptUrl: row[8],
        reminder: row[9] || null,
        recurrence: row[10] || 'once'
      });
    }
  }

  // Read Reminders
  var rData = reminderSheet.getDataRange().getValues();
  var reminders = [];
  for (var k = 1; k < rData.length; k++) {
    var rRow = rData[k];
    if (rRow[0] !== '') {
      reminders.push({
        id: rRow[0],
        createdAt: formatDateStr(rRow[1]),
        description: rRow[2],
        reminder: rRow[3],
        recurrence: rRow[4] || 'once',
        isQuickReminder: true
      });
    }
  }
  
  // Read Master
  var masterData = masterSheet.getDataRange().getValues();
  var masterOutputs = [];
  var masterMethods = [];
  var masterSources = [];
  for (var j = 1; j < masterData.length; j++) {
    if (masterData[j][0] !== '') masterOutputs.push(masterData[j][0]);
    if (masterData[j][1] !== '') masterMethods.push(masterData[j][1]);
    if (masterData[j][2] !== '') masterSources.push(masterData[j][2]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    transactions: transactions,
    reminders: reminders,
    masterOutputs: masterOutputs,
    masterMethods: masterMethods,
    masterSources: masterSources
  })).setMimeType(ContentService.MimeType.JSON);
}

function formatDateStr(rawDate) {
  if (rawDate instanceof Date) {
    var yyyy = rawDate.getFullYear();
    var mm = String(rawDate.getMonth() + 1).padStart(2, '0');
    var dd = String(rawDate.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  return rawDate ? rawDate.toString() : '';
}

// Fungsi POST untuk menambah, menghapus data
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  
  if (action === 'add' || action === 'addQuickReminder') {
    var t = body.data;
    if (action === 'addQuickReminder') {
      var rSheet = ss.getSheetByName(REMINDERS_SHEET_NAME);
      if (!rSheet) { setup(); rSheet = ss.getSheetByName(REMINDERS_SHEET_NAME); }
      rSheet.appendRow([t.id, t.date, t.description, t.reminder, t.recurrence]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = ss.getSheetByName(SHEET_NAME);
    var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
    if (!sheet || !masterSheet) { setup(); sheet = ss.getSheetByName(SHEET_NAME); masterSheet = ss.getSheetByName(MASTER_SHEET_NAME); }
    
    var fileUrl = body.fileBase64 ? uploadFileToDrive(body.fileBase64, body.fileMimeType, body.fileName) : "";
    
    sheet.appendRow([t.id, t.date, t.type, t.output, t.amount, t.paymentMethod, t.fundSource, t.description, fileUrl, t.reminder || "", t.recurrence || 'once']);
    
    if (t.output) updateMasterList(masterSheet, t.output, 0);
    if (t.paymentMethod) updateMasterList(masterSheet, t.paymentMethod, 1);
    if (t.fundSource) updateMasterList(masterSheet, t.fundSource, 2);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', fileUrl: fileUrl })).setMimeType(ContentService.MimeType.JSON);
  } 
  else if (action === 'edit') {
    var t = body.data;
    var sheet = ss.getSheetByName(t.isQuickReminder ? REMINDERS_SHEET_NAME : SHEET_NAME);
    if (!sheet) { setup(); sheet = ss.getSheetByName(t.isQuickReminder ? REMINDERS_SHEET_NAME : SHEET_NAME); }
    
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() === t.id.toString()) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex > -1) {
      if (t.isQuickReminder) {
        sheet.getRange(rowIndex, 3, 1, 3).setValues([[t.description, t.reminder, t.recurrence]]);
      } else {
        var fileUrl = data[rowIndex - 1][8];
        if (body.isReceiptDeleted && fileUrl) { deleteFileFromDrive(fileUrl); fileUrl = ""; }
        if (body.fileBase64) fileUrl = uploadFileToDrive(body.fileBase64, body.fileMimeType, body.fileName);
        
        sheet.getRange(rowIndex, 2, 1, 10).setValues([[t.date, t.type, t.output, t.amount, t.paymentMethod, t.fundSource, t.description, fileUrl, t.reminder || "", t.recurrence || 'once']]);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  }
  else if (action === 'delete') {
    var idToDelete = body.id;
    var sheets = [ss.getSheetByName(SHEET_NAME), ss.getSheetByName(REMINDERS_SHEET_NAME)];
    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      if (!sheet) continue;
      var data = sheet.getDataRange().getValues();
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0].toString() === idToDelete.toString()) {
          if (s === 0 && data[i][8]) deleteFileFromDrive(data[i][8]);
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'ID not found'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  else if (action === 'clear') {
    var sheet = ss.getSheetByName(SHEET_NAME);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Action not found'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi Helper untuk menghapus file dari Drive
function deleteFileFromDrive(fileUrl) {
  try {
    if (!fileUrl || !fileUrl.includes("id=")) {
      // Jika formatnya bukan URL Drive dengan ID, coba ekstrak dari format lain
      // Format umum: https://drive.google.com/file/d/FILE_ID/view
      var fileId = "";
      if (fileUrl.includes("/d/")) {
        fileId = fileUrl.split("/d/")[1].split("/")[0];
      } else if (fileUrl.includes("id=")) {
        fileId = fileUrl.split("id=")[1].split("&")[0];
      }
      
      if (fileId) {
        DriveApp.getFileById(fileId).setTrashed(true);
      }
    } else {
       var fileId = fileUrl.split("id=")[1].split("&")[0];
       DriveApp.getFileById(fileId).setTrashed(true);
    }
  } catch (e) {
    console.error("Gagal menghapus file: " + e.toString());
  }
}

// Fungsi Helper untuk upload file agar lebih rapi dan ada logging
function uploadFileToDrive(base64Data, mimeType, fileName) {
  try {
    var decodedData = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedData, mimeType, fileName);
    
    var folder;
    var folders = DriveApp.getFoldersByName(FOLDER_NAME);
    
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(FOLDER_NAME);
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {
        console.warn("Gagal mengatur sharing folder: " + e.message);
      }
    }
    
    var file = folder.createFile(blob);
    // Pastikan file juga bisa dilihat oleh semua yang punya link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}
    
    return file.getUrl();
  } catch (error) {
    console.error("Upload Error: " + error.toString());
    return "Error: " + error.toString();
  }
}

// Fungsi Tes Manual: Jalankan ini di editor GAS untuk tes apakah DriveApp bekerja
function testDriveAccess() {
  try {
    var folder = DriveApp.createFolder("TES_AKSES_DRIVE_" + new Date().getTime());
    var file = folder.createFile("test.txt", "DriveApp bekerja dengan baik!");
    console.log("Berhasil! File dibuat di: " + file.getUrl());
    return "Sukses";
  } catch (e) {
    console.error("Gagal Tes Drive: " + e.toString());
    return "Gagal: " + e.toString();
  }
}
// Helper untuk update daftar master (Output, Metode, Sumber Dana)
function updateMasterList(sheet, value, columnIndex) {
  var data = sheet.getDataRange().getValues();
  var valueTrimmed = value.toString().trim();
  var valueLower = valueTrimmed.toLowerCase();
  
  var exists = false;
  var lastRow = data.length;
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][columnIndex] && data[i][columnIndex].toString().toLowerCase() === valueLower) {
      exists = true;
      break;
    }
    // Cari baris kosong pertama di kolom ini
    if (targetRow === -1 && (!data[i][columnIndex] || data[i][columnIndex] === '')) {
      targetRow = i + 1;
    }
  }

  if (!exists) {
    if (targetRow === -1) {
      targetRow = lastRow + 1;
    }
    sheet.getRange(targetRow, columnIndex + 1).setValue(valueTrimmed);
  }
}
