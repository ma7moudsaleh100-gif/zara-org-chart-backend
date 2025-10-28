// initialData.js
// انسخ كل المصفوفات الافتراضية من ملف HTML الحالي وضعه هنا

const initialAvailableTrainingTopics = [
    "English Communication",
    // ... rest of the training topics
];

const initialCustomTrainingTopics = [
    // ... rest of the custom training objects
];

const initialEmployees = [
    // ... all the employee objects
];

// يجب أن تصدر هذه المتغيرات لاستخدامها في server.js
module.exports = {
  initialEmployees,
  initialTraining: {
    customTrainingTopics: initialCustomTrainingTopics,
    availableTrainingTopics: initialAvailableTrainingTopics
  }
};