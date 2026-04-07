const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const config = require('./config');

const CSV_PATH = path.join(config.OUTPUT_DIR, 'Brand Leads.csv');

const csvWriter = createObjectCsvWriter({
  path: CSV_PATH,
  header: [
    { id: 'email',        title: 'Email' },
    { id: 'ownerName',    title: 'Owner Name' },
    { id: 'companyName',  title: 'Brand Name' },
    { id: 'website',      title: 'Website' },
    { id: 'brandType',    title: 'Brand Type' },
    { id: 'country',      title: 'Country' },
    { id: 'emailType',    title: 'Email Type' },
    { id: 'qualityScore', title: 'Quality Score' },
    { id: 'source',       title: 'Source' }
  ],
  append: true
});

const csvWriterFresh = (outputPath) => createObjectCsvWriter({
  path: outputPath || CSV_PATH,
  header: [
    { id: 'email',        title: 'Email' },
    { id: 'ownerName',    title: 'Owner Name' },
    { id: 'companyName',  title: 'Brand Name' },
    { id: 'website',      title: 'Website' },
    { id: 'brandType',    title: 'Brand Type' },
    { id: 'country',      title: 'Country' },
    { id: 'emailType',    title: 'Email Type' },
    { id: 'qualityScore', title: 'Quality Score' },
    { id: 'source',       title: 'Source' }
  ]
});

module.exports = { csvWriter, csvWriterFresh, CSV_PATH };
