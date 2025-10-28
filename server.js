// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // لإدارة رفع الملفات (الصور)
const { initialEmployees, initialTraining } = require('./initialData'); // البيانات الافتراضية

const app = express();
const PORT = 3000;
const DB_URI = 'mongodb://localhost:27017/orgchartdb'; // رابط قاعدة البيانات الافتراضي

// --- 1. إعدادات الخادم والاتصال بالداتا بيز ---

app.use(cors()); // السماح لمتصفح الويب بالوصول إلى الخادم
app.use(express.json({ limit: '50mb' })); // لقبول بيانات كبيرة (بسبب الصور المشفرة مؤقتاً)
app.use(express.static('uploads')); // لخدمة الصور المخزنة في مجلد 'uploads'

// اتصال MongoDB
mongoose.connect(DB_URI)
  .then(() => console.log('✅ MongoDB connected successfully!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// تعريف نموذج الداتا بيز (Schema)
const OrgChartSchema = new mongoose.Schema({
  employees: Array,
  customTrainingTopics: Array,
  availableTrainingTopics: Array,
  lastUpdated: { type: Date, default: Date.now }
});

const OrgChartData = mongoose.model('OrgChartData', OrgChartSchema);

// --- 2. إعداد multer لتخزين الصور مؤقتاً ---

// قم بإنشاء مجلد 'uploads' إذا لم يكن موجوداً
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// إعداد التخزين (سنخزن الملفات في مجلد 'uploads')
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // حفظ الملف باسم فريد
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// --- 3. واجهات API (Endpoints) ---

// واجهة GET: لتحميل جميع البيانات
app.get('/api/employees', async (req, res) => {
  try {
    let data = await OrgChartData.findOne().sort({ lastUpdated: -1 });

    if (!data) {
      // إذا لم يتم العثور على بيانات، استخدم البيانات الافتراضية
      data = new OrgChartData({
        employees: initialEmployees,
        customTrainingTopics: initialTraining.customTrainingTopics,
        availableTrainingTopics: initialTraining.availableTrainingTopics,
      });
      await data.save(); // واحفظها في الداتا بيز لأول مرة
      console.log('Using and saving initial default data.');
    }
    
    // إزالة خاصية 'photo' إذا كانت مازالت Base64 (لمعالجة البيانات القديمة)
    // *هنا يمكنك إضافة منطق لتحويل مسار الصورة إلى رابط كامل
    const responseData = {
        employees: data.employees.map(emp => {
            // إذا كان المسار يحتوي على 'uploads/' يعني أنها صورة مخزنة على السيرفر
            if (emp.photo && emp.photo.includes('uploads/')) {
                // نغير المسار إلى رابط يمكن للمتصفح الوصول إليه
                emp.photo = `http://localhost:${PORT}/${path.basename(emp.photo)}`;
            }
            return emp;
        }),
        customTrainingTopics: data.customTrainingTopics,
        availableTrainingTopics: data.availableTrainingTopics,
    };

    res.json(responseData);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Server Error');
  }
});

// واجهة POST: لتحديث وحفظ جميع البيانات
app.post('/api/employees/update', async (req, res) => {
  try {
    const newData = req.body;
    
    // يجب علينا تنظيف البيانات وإزالة البيانات القديمة قبل الحفظ
    if (!newData.employees || !Array.isArray(newData.employees)) {
        return res.status(400).send('Invalid data structure.');
    }

    // الطريقة الأبسط حالياً: تحديث المستند الأخير كاملاً
    let doc = await OrgChartData.findOne();
    if (doc) {
      doc.employees = newData.employees;
      doc.customTrainingTopics = newData.customTrainingTopics;
      doc.availableTrainingTopics = newData.availableTrainingTopics;
      doc.lastUpdated = new Date();
      await doc.save();
    } else {
      // في حالة لم يكن هناك مستند أصلاً
       doc = new OrgChartData(newData);
       await doc.save();
    }
    
    res.json({ message: 'Data saved successfully.' });
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).send('Server Error');
  }
});

// واجهة POST: لرفع صورة موظف جديد وتحديث بياناته
app.post('/api/employees/:id/upload-photo', upload.single('newPhoto'), async (req, res) => {
    try {
        const employeeId = parseInt(req.params.id);
        const filePath = req.file.path; // المسار المؤقت للملف المرفوع
        
        let doc = await OrgChartData.findOne();
        if (doc) {
            const employeeIndex = doc.employees.findIndex(e => e.id === employeeId);
            if (employeeIndex !== -1) {
                // حفظ مسار الملف في الداتا بيز
                doc.employees[employeeIndex].photo = filePath; 
                doc.employees[employeeIndex].lastUpdated = new Date();
                await doc.save();

                // إرجاع الرابط الكامل ليتم تحديثه في الواجهة الأمامية
                const photoUrl = `http://localhost:${PORT}/${path.basename(filePath)}`;
                return res.json({ photo: photoUrl });
            }
        }
        res.status(404).send('Employee not found.');

    } catch (err) {
        console.error('Error uploading photo:', err);
        res.status(500).send('Server Error');
    }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('----------------------------------------------------');
  console.log('** IMPORTANT: MongoDB MUST be running on port 27017 **');
});