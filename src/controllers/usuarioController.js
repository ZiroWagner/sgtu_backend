const bcrypt = require('bcryptjs');
const { supabase } = require('../config/database');
const { generateToken } = require('../utils/jwtUtils');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const processAndUploadImage = async (imageBuffer) => {
  if (!imageBuffer) return null;

  try {
    const processedImageBuffer = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `${uuidv4()}.webp`;
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(fileName, processedImageBuffer, {
        contentType: 'image/webp',
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error processing and uploading image:', error);
    return null;
  }
};

const register = async (req, res) => {
  const { nombre, apellido, correo, password, rol, dni, fecha_nacimiento } = req.body;
  console.log('password recibida:', req.body);  // Verifica el valor recibido
  const imageBuffer = req.file ? req.file.buffer : null;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    let img_ruta = null;
    if (imageBuffer) {
      img_ruta = await processAndUploadImage(imageBuffer);
    }

    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        nombre,
        apellido,
        correo,
        password: hashedPassword,
        rol,
        img_ruta,
        dni,
        fecha_nacimiento
      })
      .select();

    if (error) throw error;

    const token = generateToken(data[0].id, data[0].rol);
    res.status(201).json({ user: data[0], token });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ message: error.message || 'An error occurred during registration' });
  }
};


const login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !data) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, data.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(data.id, data.rol);
    res.json({ user: data, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, correo, rol, estado, telefono } = req.body;
  const imageBuffer = req.file ? req.file.buffer : null;

  try {
    let img_ruta = undefined;
    if (imageBuffer) {
      img_ruta = await processAndUploadImage(imageBuffer);
    }

    const { data, error } = await supabase
      .from('usuarios')
      .update({ nombre, apellido, correo, rol, img_ruta, estado, telefono })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ estado })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};