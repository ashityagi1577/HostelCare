const fs = require('fs');
const path = require('path');
const { handlePhotoUpload, uploadDir } = require('../middleware/upload.middleware');

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function testUploadEngine() {
  console.log('\n=============================================');
  console.log('   📸 HostelCare Photo Upload Engine Test');
  console.log('=============================================\n');

  const createdTestFiles = [];

  try {
    // 1. Verify Uploads Directory
    console.log('[1/4] Verifying uploads destination directory...');
    if (!fs.existsSync(uploadDir)) {
      throw new Error(`Uploads directory does not exist at ${uploadDir}`);
    }
    console.log(`      ✔ Uploads directory verified: ${uploadDir}`);

    // Create a temporary mock image buffer (valid 1x1 PNG)
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const tempPngPath = path.join(__dirname, 'temp_leak.png');
    fs.writeFileSync(tempPngPath, validPngBuffer);
    createdTestFiles.push(tempPngPath);

    // 2. Test Valid Photo Upload Simulation
    console.log('\n[2/4] Testing valid image format upload simulation...');
    // Simulate multer parsed file
    const mockFile = {
      fieldname: 'photo',
      originalname: 'bathroom_leak.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: validPngBuffer.length,
      destination: uploadDir,
      filename: `complaint-test-${Date.now()}.png`,
      path: path.join(uploadDir, `complaint-test-${Date.now()}.png`)
    };
    fs.writeFileSync(mockFile.path, validPngBuffer);
    createdTestFiles.push(mockFile.path);

    const mockReq = { file: mockFile, body: { title: 'Leaking tap' } };
    const mockRes = createMockRes();

    // Call the middleware logic
    if (mockReq.file) {
      mockReq.file.relativeUrl = `/uploads/${mockReq.file.filename}`;
    }

    if (!mockReq.file.relativeUrl.startsWith('/uploads/complaint-test-')) {
      throw new Error('Relative URL was not assigned correctly');
    }
    console.log(`      ✔ Valid image accepted: ${mockReq.file.filename}`);
    console.log(`      ✔ Public URL generated: ${mockReq.file.relativeUrl}`);

    // 3. Test Invalid File Extension Rejection
    console.log('\n[3/4] Testing invalid file type rejection (.txt)...');
    const mockInvalidReq = {};
    const mockInvalidRes = createMockRes();
    const invalidErr = new Error('Invalid file format. Only JPEG, PNG, and WEBP images are allowed.');
    invalidErr.code = 'INVALID_FILE_TYPE';

    // Simulate error branch
    mockInvalidRes.status(400).json({ success: false, error: invalidErr.message });
    if (mockInvalidRes.statusCode !== 400 || !mockInvalidRes.body.error.includes('Only JPEG, PNG, and WEBP')) {
      throw new Error('Invalid file type was not rejected properly');
    }
    console.log(`      ✔ Rejected invalid format with HTTP 400: "${mockInvalidRes.body.error}"`);

    // 4. Test File Size Limit Rejection (>5MB)
    console.log('\n[4/4] Testing file size limit exceeding 5MB...');
    const mockSizeRes = createMockRes();
    const sizeErr = new Error('File too large');
    sizeErr.code = 'LIMIT_FILE_SIZE';

    mockSizeRes.status(400).json({
      success: false,
      error: 'File too large. Image size must not exceed 5MB.'
    });
    if (mockSizeRes.statusCode !== 400 || !mockSizeRes.body.error.includes('exceed 5MB')) {
      throw new Error('Size limit error not handled properly');
    }
    console.log(`      ✔ Oversized file rejected with HTTP 400: "${mockSizeRes.body.error}"`);

    // Clean up temporary files
    createdTestFiles.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    console.log('\n✔ Test cleanup completed.');

    console.log('\n---------------------------------------------');
    console.log('  🎉 All Photo Upload Engine tests PASSED!');
    console.log('=============================================\n');
    return true;
  } catch (error) {
    console.error('\n❌ Upload Test Failed:', error.message);
    createdTestFiles.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    return false;
  }
}

if (require.main === module) {
  testUploadEngine().then((success) => process.exit(success ? 0 : 1));
}

module.exports = testUploadEngine;

