const registrationForm = document.getElementById('registration-form');

registrationForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(registrationForm);
  const payload = Object.fromEntries(formData.entries());

  console.log('Student registration submitted:', payload);
});
