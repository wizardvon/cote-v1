const registrationForm = document.getElementById('registration-form');
const formMessage = document.getElementById('form-message');

const requiredFields = [
  'firstName',
  'lastName',
  'sex',
  'birthday',
  'lrn',
  'phoneNumber',
  'address',
  'email',
  'password',
];

registrationForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const payload = Object.fromEntries(formData.entries());

  const missingFields = requiredFields.filter((fieldName) => {
    const value = payload[fieldName];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missingFields.length > 0) {
    showFormMessage('Please fill in all required fields before submitting.', 'error');
    return;
  }

  showFormMessage('Student registration submitted successfully.', 'success');
  console.log('Student registration submitted:', payload);
});

function showFormMessage(message, type) {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = message;
  formMessage.classList.remove('success', 'error');
  formMessage.classList.add(type);
}


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
