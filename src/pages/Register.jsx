import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  sex: '',
  email: '',
  password: '',
};

function Register() {
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );

      const { uid } = credential.user;
      const payload = {
        uid,
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        lastName: formData.lastName.trim(),
        sex: formData.sex,
        email: formData.email.trim().toLowerCase(),
        role: 'student',
        createdAt: serverTimestamp(),
      };

      await Promise.all([
        setDoc(doc(db, 'students', uid), payload),
        setDoc(doc(db, 'users', uid), payload),
      ]);

      setSuccess('Registration successful.');
      setFormData(initialForm);
    } catch (submitError) {
      setError(submitError.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>COTE Student Registration</h1>

        <label htmlFor="firstName">First Name</label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          value={formData.firstName}
          onChange={handleChange}
          required
        />

        <label htmlFor="middleName">Middle Name</label>
        <input
          id="middleName"
          name="middleName"
          type="text"
          value={formData.middleName}
          onChange={handleChange}
        />

        <label htmlFor="lastName">Last Name</label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          value={formData.lastName}
          onChange={handleChange}
          required
        />

        <label htmlFor="sex">Sex</label>
        <select
          id="sex"
          name="sex"
          value={formData.sex}
          onChange={handleChange}
          required
        >
          <option value="" disabled>
            Select sex
          </option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
      </form>
    </main>
  );
}

export default Register;
