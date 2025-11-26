const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DB_FILE = path.join(__dirname, 'data.json');
function readDB(){
  if (!fs.existsSync(DB_FILE)) return { logs: [] };
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function writeDB(obj){ fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2)); }

// POST /api/logs  -> store or upsert a log
app.post('/api/logs', (req,res)=>{
  const db = readDB();
  const log = req.body;
  const idx = db.logs.findIndex(l=>l.id===log.id);
  if (idx>=0) db.logs[idx] = log; else db.logs.push(log);
  writeDB(db);
  res.json({ok:true});
});

// GET /api/logs/:studentId
app.get('/api/logs/:studentId', (req,res)=>{
  const db = readDB();
  const logs = db.logs.filter(l=>l.studentId===req.params.studentId);
  logs.sort((a,b)=> new Date(a.ts)-new Date(b.ts));
  res.json(logs);
});

app.listen(3000, ()=>console.log('Server running on http://localhost:3000'));
