import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  Geologica_400Regular,
  Geologica_500Medium,
  Geologica_600SemiBold,
  Geologica_700Bold,
  Geologica_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/geologica';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Modal,
} from 'react-native';

const cityOptions = ['Санкт-Петербург', 'Москва', 'Тбилиси', 'Берлин', 'Любая локация'];
const serviceOptions = ['Разовая', 'Регулярная', 'Утро + вечер', 'Зоотакси', 'Котоняня'];
const tabs = [
  { id: 'feed', label: 'Поиск', icon: 'search' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar-clear-outline' },
  { id: 'requests', label: 'Заявки', icon: 'paw-outline' },
  { id: 'chat', label: 'Чат', icon: 'chatbubble-ellipses-outline' },
  { id: 'profile', label: 'Профиль', icon: 'person-circle-outline' },
];

const dogPhotos = [
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=900&q=80',
];
const minTransferMinutes = 30;
const fonts = {
  regular: 'Geologica_400Regular',
  medium: 'Geologica_500Medium',
  semibold: 'Geologica_600SemiBold',
  bold: 'Geologica_700Bold',
  extraBold: 'Geologica_800ExtraBold',
};

const serviceMeta = {
  Разовая: { icon: 'footsteps-outline', tint: '#F6D8BF', text: 'один выход' },
  Регулярная: { icon: 'repeat-outline', tint: '#DDEACD', text: 'по графику' },
  'Утро + вечер': { icon: 'partly-sunny-outline', tint: '#F8E7AE', text: 'два раза' },
  Зоотакси: { icon: 'car-outline', tint: '#D9EAF2', text: 'поездка' },
  Котоняня: { icon: 'home-outline', tint: '#E9D7EE', text: 'уход дома' },
};

let database;

function createWebDatabase() {
  const key = 'pawgo-web-db-v1';
  const initial = { meta: [], users: [], walkers: [], dogs: [], availability: [], posts: [], bookings: [], reviews: [], messages: [] };
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  const state = stored ? JSON.parse(stored) : initial;
  const save = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(state));
  };
  const nextId = (table) => Math.max(0, ...state[table].map((item) => item.id || 0)) + 1;
  const insert = (table, item) => {
    const id = nextId(table);
    state[table].push({ id, ...item });
    save();
    return { lastInsertRowId: id };
  };

  return {
    async execAsync() {},
    async getFirstAsync(sql, params = []) {
      if (sql.includes('FROM meta')) return state.meta.find((item) => item.key === params[0]) || null;
      return null;
    },
    async getAllAsync(sql) {
      if (sql.startsWith('PRAGMA table_info')) return [];
      if (sql.includes('FROM walkers') && sql.includes('JOIN users')) {
        return [...state.walkers].map((walker) => ({ ...walker, ...state.users.find((user) => user.id === walker.user_id) })).sort((a, b) => b.rating - a.rating);
      }
      if (sql.includes('FROM posts') && sql.includes('JOIN dogs')) {
        return [...state.posts].map((post) => {
          const dog = state.dogs.find((item) => item.id === post.dog_id) || {};
          return { ...post, dog_name: dog.name, breed: dog.breed, age: dog.age, temperament: dog.temperament, photo: dog.photo };
        }).sort((a, b) => b.id - a.id);
      }
      if (sql.includes('FROM dogs')) return [...state.dogs].sort((a, b) => a.id - b.id);
      if (sql.includes('FROM availability')) return [...state.availability].sort((a, b) => a.id - b.id);
      if (sql.includes('FROM bookings')) return [...state.bookings].sort((a, b) => b.id - a.id);
      if (sql.includes('FROM reviews')) return [...state.reviews].sort((a, b) => b.id - a.id);
      if (sql.includes('FROM messages')) return [...state.messages].sort((a, b) => a.id - b.id);
      if (sql.includes('FROM users')) return [...state.users].sort((a, b) => b.id - a.id);
      return [];
    },
    async runAsync(sql, params = []) {
      if (sql.startsWith('INSERT INTO users') && params.length === 5) return insert('users', { name: params[0], role: params[1], city: params[2], avatar: params[3], about: params[4], phone: '', phone_verified: 0, verification_code: '', partner_requested: 0, contract_status: 'none' });
      if (sql.startsWith('INSERT INTO users') && params.length === 10) return insert('users', { name: params[0], role: params[1], city: params[2], avatar: params[3], about: params[4], phone: params[5], phone_verified: params[6], verification_code: params[7], partner_requested: params[8], contract_status: params[9] });
      if (sql.startsWith('INSERT INTO walkers')) return insert('walkers', { user_id: params[0], rating: params[1], reviews_count: params[2], price_walk: params[3], price_taxi: params[4], tags: params[5], radius: params[6], repeat_clients: params[7] });
      if (sql.startsWith('INSERT INTO dogs')) return insert('dogs', { owner_id: params[0], name: params[1], breed: params[2], age: params[3], temperament: params[4], photo: params[5] });
      if (sql.startsWith('INSERT INTO availability')) return insert('availability', { walker_id: params[0], day: params[1], time: params[2], slot_type: params[3] });
      if (sql.startsWith('INSERT INTO posts') && params.length === 7) return insert('posts', { dog_id: params[0], city: params[1], title: params[2], service_type: params[3], schedule: params[4], budget: params[5], status: params[6], address: '', notes: '', urgency: 'normal' });
      if (sql.startsWith('INSERT INTO posts') && params.length === 10) return insert('posts', { dog_id: params[0], city: params[1], title: params[2], service_type: params[3], schedule: params[4], budget: params[5], status: params[6], address: params[7], notes: params[8], urgency: params[9] });
      if (sql.startsWith('INSERT INTO bookings') && params.length === 6) return insert('bookings', { walker_id: params[0], dog_id: params[1], service_type: params[2], schedule: params[3], status: params[4], created_at: params[5], address: '', notes: '' });
      if (sql.startsWith('INSERT INTO bookings') && params.length === 8) return insert('bookings', { walker_id: params[0], dog_id: params[1], service_type: params[2], schedule: params[3], status: params[4], created_at: params[5], address: params[6], notes: params[7] });
      if (sql.startsWith('INSERT INTO reviews')) return insert('reviews', { target_type: params[0], target_id: params[1], author: params[2], rating: params[3], text: params[4] });
      if (sql.startsWith('INSERT INTO messages')) return insert('messages', { thread: params[0], author: params[1], text: params[2], created_at: params[3] });
      if (sql.startsWith('INSERT INTO meta')) { state.meta.push({ key: params[0], value: params[1] }); save(); return { lastInsertRowId: state.meta.length }; }
      if (sql.startsWith('UPDATE walkers SET tags')) { const walker = state.walkers.find((item) => item.id === params[1]); if (walker) walker.tags = params[0]; save(); }
      return { lastInsertRowId: 0 };
    },
  };
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function parseBookedSlot(schedule) {
  const match = schedule.match(/^(.+),\s(\d{2}:\d{2})$/);
  if (!match) return null;
  return { day: match[1], minutes: minutesFromTime(match[2]) };
}

function findScheduleConflict(bookings, walkerId, day, time) {
  const target = minutesFromTime(time);
  return bookings.find((booking) => {
    if (booking.walker_id !== walkerId) return false;
    const booked = parseBookedSlot(booking.schedule);
    if (!booked || booked.day !== day) return false;
    return Math.abs(booked.minutes - target) < minTransferMinutes;
  });
}

async function getDatabase() {
  if (!database) {
    database = Platform.OS === 'web' ? createWebDatabase() : await SQLite.openDatabaseAsync('pawgo.db');
  }
  return database;
}

async function setupDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      city TEXT NOT NULL,
      avatar TEXT,
      about TEXT
    );
    CREATE TABLE IF NOT EXISTS walkers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      rating REAL NOT NULL,
      reviews_count INTEGER NOT NULL,
      price_walk INTEGER NOT NULL,
      price_taxi INTEGER NOT NULL,
      tags TEXT NOT NULL,
      radius TEXT NOT NULL,
      repeat_clients INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      breed TEXT NOT NULL,
      age TEXT NOT NULL,
      temperament TEXT NOT NULL,
      photo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walker_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      slot_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dog_id INTEGER NOT NULL,
      city TEXT NOT NULL,
      title TEXT NOT NULL,
      service_type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      budget INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      walker_id INTEGER NOT NULL,
      dog_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread TEXT NOT NULL,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await ensureColumn(db, 'users', 'phone', 'TEXT');
  await ensureColumn(db, 'users', 'phone_verified', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'users', 'verification_code', 'TEXT');
  await ensureColumn(db, 'users', 'partner_requested', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'users', 'contract_status', 'TEXT NOT NULL DEFAULT "none"');
  await ensureColumn(db, 'posts', 'address', 'TEXT');
  await ensureColumn(db, 'posts', 'notes', 'TEXT');
  await ensureColumn(db, 'posts', 'urgency', 'TEXT NOT NULL DEFAULT "normal"');
  await ensureColumn(db, 'bookings', 'address', 'TEXT');
  await ensureColumn(db, 'bookings', 'notes', 'TEXT');

  const seeded = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['seeded']);
  if (seeded) {
    await ensureTransferRuleSeed(db);
    await ensureCaregiverSeed(db);
    return db;
  }

  await db.runAsync('INSERT INTO users (name, role, city, avatar, about) VALUES (?, ?, ?, ?, ?)', [
    'Марта Лебедева',
    'walker',
    'Санкт-Петербург',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
    'Выгул в Петроградке и центре, спокойно работаю с тревожными собаками.',
  ]);
  await db.runAsync('INSERT INTO users (name, role, city, avatar, about) VALUES (?, ?, ?, ?, ?)', [
    'Илья Ким',
    'walker',
    'Санкт-Петербург',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    'Активные прогулки, зоотакси, фотоотчет после каждого выхода.',
  ]);
  await db.runAsync('INSERT INTO users (name, role, city, avatar, about) VALUES (?, ?, ?, ?, ?)', [
    'Ника Вольф',
    'walker',
    'Берлин',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=500&q=80',
    'Регулярные вечерние маршруты и сопровождение к ветеринару.',
  ]);
  await db.runAsync('INSERT INTO users (name, role, city, avatar, about) VALUES (?, ?, ?, ?, ?)', [
    'Аня и Сэм',
    'owner',
    'Санкт-Петербург',
    dogPhotos[0],
    'Ищем надежного человека для джек-рассела Сэма.',
  ]);

  await db.runAsync('INSERT INTO walkers (user_id, rating, reviews_count, price_walk, price_taxi, tags, radius, repeat_clients) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [1, 4.9, 128, 850, 1800, 'мелкие породы, котоняня, фотоотчет', 'Петроградка + 3 км', 41]);
  await db.runAsync('INSERT INTO walkers (user_id, rating, reviews_count, price_walk, price_taxi, tags, radius, repeat_clients) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [2, 4.8, 96, 900, 1600, 'активный выгул, зоотакси, крупные', 'Центр, Васильевский', 34]);
  await db.runAsync('INSERT INTO walkers (user_id, rating, reviews_count, price_walk, price_taxi, tags, radius, repeat_clients) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [3, 4.7, 52, 1200, 2200, 'котоняня, ветеринар, EN/RU', 'Berlin Mitte', 18]);

  await db.runAsync('INSERT INTO dogs (owner_id, name, breed, age, temperament, photo) VALUES (?, ?, ?, ?, ?, ?)', [4, 'Сэм', 'джек-рассел', '3 года', 'энергичный, отвлекается на улице', dogPhotos[0]]);
  await db.runAsync('INSERT INTO dogs (owner_id, name, breed, age, temperament, photo) VALUES (?, ?, ?, ?, ?, ?)', [4, 'Луна', 'корги', '5 лет', 'спокойная, любит короткие маршруты', dogPhotos[1]]);
  await db.runAsync('INSERT INTO dogs (owner_id, name, breed, age, temperament, photo) VALUES (?, ?, ?, ?, ?, ?)', [4, 'Бруно', 'метис', '1 год', 'учится ходить рядом, нужен терпеливый выгул', dogPhotos[2]]);

  const slots = [
    [1, 'Сегодня', '08:00', 'утро'],
    [1, 'Сегодня', '19:30', 'вечер'],
    [1, 'Завтра', '07:30', 'утро'],
    [1, 'Пт', '20:00', 'вечер'],
    [2, 'Сегодня', '12:00', 'день'],
    [2, 'Завтра', '18:00', 'вечер'],
    [2, 'Сб', '10:00', 'зоотакси'],
    [3, 'Пн', '19:00', 'вечер'],
    [3, 'Вт', '08:30', 'утро'],
  ];
  for (const slot of slots) {
    await db.runAsync('INSERT INTO availability (walker_id, day, time, slot_type) VALUES (?, ?, ?, ?)', slot);
  }

  await db.runAsync('INSERT INTO posts (dog_id, city, title, service_type, schedule, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [1, 'Санкт-Петербург', 'Нужен вечерний выгул для Сэма', 'Регулярная', 'будни, 19:00-21:00', 900, 'open']);
  await db.runAsync('INSERT INTO posts (dog_id, city, title, service_type, schedule, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [2, 'Санкт-Петербург', 'Разовая прогулка для Луны', 'Разовая', 'завтра утром', 750, 'open']);
  await db.runAsync('INSERT INTO posts (dog_id, city, title, service_type, schedule, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [3, 'Москва', 'Зоотакси до клиники', 'Зоотакси', 'пятница 12:30', 1800, 'open']);

  await db.runAsync('INSERT INTO reviews (target_type, target_id, author, rating, text) VALUES (?, ?, ?, ?, ?)', ['walker', 1, 'Оля и Бас', 5, 'Марта пунктуальная, присылает маршрут и фото. Бас возвращается спокойным.']);
  await db.runAsync('INSERT INTO reviews (target_type, target_id, author, rating, text) VALUES (?, ?, ?, ?, ?)', ['walker', 2, 'Дима', 5, 'Илья помог с зоотакси и не торопил собаку у подъезда.']);
  await db.runAsync('INSERT INTO reviews (target_type, target_id, author, rating, text) VALUES (?, ?, ?, ?, ?)', ['dog', 1, 'Марта', 5, 'Сэм активный, но быстро включается в команды. Хозяева все подробно объяснили.']);

  await db.runAsync('INSERT INTO messages (thread, author, text, created_at) VALUES (?, ?, ?, ?)', ['marta-sam', 'Марта', 'Могу взять Сэма сегодня в 19:30. Оставить ключи у консьержа?', '18:02']);
  await db.runAsync('INSERT INTO messages (thread, author, text, created_at) VALUES (?, ?, ?, ?)', ['marta-sam', 'Аня', 'Да, и положу шлейку рядом с поводком.', '18:05']);

  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['seeded', 'true']);
  await ensureTransferRuleSeed(db);
  await ensureCaregiverSeed(db);
  return db;
}

async function ensureColumn(db, table, column, definition) {
  const columns = await db.getAllAsync(`PRAGMA table_info(${table})`);
  if (columns.some((item) => item.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function ensureTransferRuleSeed(db) {
  const migrated = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['transfer_rule_seeded']);
  if (migrated) return;
  await db.runAsync('INSERT INTO availability (walker_id, day, time, slot_type) VALUES (?, ?, ?, ?)', [1, 'Сегодня', '08:20', 'буфер']);
  await db.runAsync('INSERT INTO availability (walker_id, day, time, slot_type) VALUES (?, ?, ?, ?)', [1, 'Сегодня', '19:50', 'буфер']);
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['transfer_rule_seeded', 'true']);
}

async function ensureCaregiverSeed(db) {
  const migrated = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['caregiver_seeded']);
  if (migrated) return;
  await db.runAsync('UPDATE walkers SET tags = ? WHERE id = ?', ['мелкие породы, котоняня, фотоотчет', 1]);
  await db.runAsync('UPDATE walkers SET tags = ? WHERE id = ?', ['котоняня, ветеринар, EN/RU', 3]);
  await db.runAsync('INSERT INTO posts (dog_id, city, title, service_type, schedule, budget, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    2,
    'Санкт-Петербург',
    'Котоняня на выходные: корм, вода и фото',
    'Котоняня',
    'суббота и воскресенье',
    1200,
    'open',
  ]);
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['caregiver_seeded', 'true']);
}

async function loadState() {
  const db = await getDatabase();
  const walkers = await db.getAllAsync(`
    SELECT walkers.*, users.name, users.city, users.avatar, users.about
    FROM walkers
    JOIN users ON users.id = walkers.user_id
    ORDER BY walkers.rating DESC
  `);
  const dogs = await db.getAllAsync('SELECT * FROM dogs ORDER BY id');
  const posts = await db.getAllAsync(`
    SELECT posts.*, dogs.name AS dog_name, dogs.breed, dogs.age, dogs.temperament, dogs.photo
    FROM posts
    JOIN dogs ON dogs.id = posts.dog_id
    ORDER BY posts.id DESC
  `);
  const availability = await db.getAllAsync('SELECT * FROM availability ORDER BY id');
  const bookings = await db.getAllAsync('SELECT * FROM bookings ORDER BY id DESC');
  const reviews = await db.getAllAsync('SELECT * FROM reviews ORDER BY id DESC');
  const messages = await db.getAllAsync('SELECT * FROM messages ORDER BY id');
  const users = await db.getAllAsync('SELECT * FROM users ORDER BY id DESC');
  return { walkers, dogs, posts, availability, bookings, reviews, messages, users };
}

function Pill({ label, active, onPress, tone = 'light' }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive, tone === 'dark' && styles.pillDark]}>
      <Text style={[styles.pillText, active && styles.pillTextActive, tone === 'dark' && styles.pillTextDark]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <View style={styles.sectionTitle}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h2}>{title}</Text>
      </View>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

function ServiceTile({ label, active, onPress }) {
  const meta = serviceMeta[label];

  return (
    <Pressable onPress={onPress} style={[styles.serviceTile, active && styles.serviceTileActive]}>
      <View style={[styles.serviceIcon, { backgroundColor: meta.tint }]}>
        <Ionicons name={meta.icon} size={20} color="#161616" />
      </View>
      <Text style={styles.serviceTitle}>{label}</Text>
      <Text style={styles.serviceText}>{meta.text}</Text>
    </Pressable>
  );
}

function WalkerCard({ walker, slots, onBook, onFocus, style }) {
  const tagList = walker.tags.split(',').map((tag) => tag.trim());

  return (
    <Pressable onPress={onFocus} style={[styles.walkerCard, style]}>
      <View style={styles.walkerTop}>
        <Image source={{ uri: walker.avatar }} style={styles.avatar} />
        <View style={styles.walkerMain}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{walker.name}</Text>
            <Text style={styles.rating}>★ {walker.rating}</Text>
          </View>
          <Text style={styles.muted}>{walker.city} · {walker.radius}</Text>
          <Text style={styles.about}>{walker.about}</Text>
        </View>
      </View>

      <View style={styles.tags}>
        {tagList.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.slotRow}>
        {slots.slice(0, 3).map((slot) => (
          <View key={slot.id} style={styles.slotChip}>
            <Text style={styles.slotDay}>{slot.day}</Text>
            <Text style={styles.slotTime}>{slot.time}</Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.price}>{walker.price_walk} ₽</Text>
          <Text style={styles.mutedSmall}>прогулка · {walker.reviews_count} отзывов</Text>
        </View>
        <Pressable onPress={() => onBook(walker)} style={styles.primaryButtonSmall}>
          <Text style={styles.primaryButtonText}>Забронировать</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function RequestCard({ post, style, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.requestCard, style]}>
      <Image source={{ uri: post.photo }} style={styles.dogPhoto} />
      <View style={styles.requestBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{post.dog_name}</Text>
          <Text style={styles.budget}>{post.budget} ₽</Text>
        </View>
        <Text style={styles.muted}>{post.breed} · {post.age} · {post.city}</Text>
        <Text style={styles.about}>{post.title}</Text>
        <View style={styles.inlineMeta}>
          <Text style={styles.inlineText}>{post.service_type}</Text>
          <Text style={styles.inlineText}>{post.schedule}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [fontsLoaded] = useFonts({
    Geologica_400Regular,
    Geologica_500Medium,
    Geologica_600SemiBold,
    Geologica_700Bold,
    Geologica_800ExtraBold,
  });
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('feed');
  const [role, setRole] = useState('owner');
  const [city, setCity] = useState('Санкт-Петербург');
  const [service, setService] = useState('Регулярная');
  const [selectedWalkerId, setSelectedWalkerId] = useState(1);
  const [messageDraft, setMessageDraft] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileCode, setProfileCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [partnerRequested, setPartnerRequested] = useState(false);
  const [profileAbout, setProfileAbout] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('Нужен выгул на этой неделе');
  const [newPostPetName, setNewPostPetName] = useState('Сэм');
  const [newPostSchedule, setNewPostSchedule] = useState('сегодня вечером');
  const [newPostAddress, setNewPostAddress] = useState('');
  const [newPostNotes, setNewPostNotes] = useState('');
  const [newPostBudget, setNewPostBudget] = useState('900');
  const [bookingAddress, setBookingAddress] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setupDatabase()
      .then(loadState)
      .then((state) => {
        if (!mounted) return;
        setData(state);
        setReady(true);
      })
      .catch((error) => {
        Alert.alert('База данных', error.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visibleWalkers = useMemo(() => {
    if (!data) return [];
    if (city === 'Любая локация') return data.walkers;
    return data.walkers.filter((walker) => walker.city === city);
  }, [city, data]);

  const visiblePosts = useMemo(() => {
    if (!data) return [];
    return data.posts.filter((post) => {
      const cityMatches = city === 'Любая локация' || post.city === city;
      const serviceMatches = !service || post.service_type === service;
      return cityMatches && serviceMatches;
    });
  }, [city, data, service]);

  const visibleFeedWalkers = useMemo(() => {
    if (!data) return [];
    return visibleWalkers.filter((walker) => {
      if (service === 'Зоотакси') return walker.price_taxi > 0;
      if (service === 'Котоняня') return walker.tags.toLowerCase().includes('котоняня');
      return true;
    });
  }, [data, service, visibleWalkers]);

  const selectedWalker = useMemo(() => {
    if (!data) return null;
    return data.walkers.find((walker) => walker.id === selectedWalkerId) || data.walkers[0];
  }, [data, selectedWalkerId]);

  const selectedSlots = useMemo(() => {
    if (!data || !selectedWalker) return [];
    return data.availability.filter((slot) => slot.walker_id === selectedWalker.id);
  }, [data, selectedWalker]);

  const selectedBookingSlots = useMemo(() => {
    return selectedSlots.filter((slot) => selectedSlotIds.includes(slot.id));
  }, [selectedSlotIds, selectedSlots]);

  useEffect(() => {
    setSelectedSlotIds([]);
  }, [selectedWalkerId]);

  async function refresh() {
    setData(await loadState());
  }

  function openBooking(walker) {
    setSelectedWalkerId(walker.id);
    setActiveTab('calendar');
  }

  function toggleSlot(slot) {
    if (role === 'walker') return;
    if (selectedSlotIds.includes(slot.id)) {
      setSelectedSlotIds((current) => current.filter((id) => id !== slot.id));
      return;
    }
    const existingConflict = findScheduleConflict(data.bookings, selectedWalker.id, slot.day, slot.time);
    if (existingConflict) {
      Alert.alert(
        'Нужно 30 минут между прогулками',
        `У ${selectedWalker.name} уже есть бронь ${existingConflict.schedule}. Выберите время с запасом минимум ${minTransferMinutes} минут.`
      );
      return;
    }
    const selectedConflict = selectedBookingSlots.find((selectedSlot) => {
      return selectedSlot.day === slot.day && Math.abs(minutesFromTime(selectedSlot.time) - minutesFromTime(slot.time)) < minTransferMinutes;
    });
    if (selectedConflict) {
      Alert.alert(
        'Слишком близкие слоты',
        `Между ${selectedConflict.time} и ${slot.time} меньше ${minTransferMinutes} минут. Выберите один из них.`
      );
      return;
    }
    setSelectedSlotIds((current) => [...current, slot.id]);
  }

  async function continueBooking() {
    if (!selectedWalker || selectedBookingSlots.length === 0) {
      Alert.alert('Выберите время', 'Сначала отметьте один или несколько свободных слотов.');
      return;
    }
    const db = await getDatabase();
    for (const slot of selectedBookingSlots) {
      const conflict = findScheduleConflict(data.bookings, selectedWalker.id, slot.day, slot.time);
      if (conflict) {
        Alert.alert(
          'Нужно 30 минут между прогулками',
          `У ${selectedWalker.name} уже есть бронь ${conflict.schedule}. Выберите время с запасом минимум ${minTransferMinutes} минут.`
        );
        return;
      }
      await db.runAsync(
        'INSERT INTO bookings (walker_id, dog_id, service_type, schedule, status, created_at, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [selectedWalker.id, 1, service, `${slot.day}, ${slot.time}`, 'requested', new Date().toISOString(), bookingAddress.trim(), bookingNotes.trim()]
      );
    }
    setSelectedSlotIds([]);
    setBookingAddress('');
    setBookingNotes('');
    await refresh();
  }

  async function respondToPost(post) {
    const db = await getDatabase();
    await db.runAsync('INSERT INTO messages (thread, author, text, created_at) VALUES (?, ?, ?, ?)', [
      'marta-sam',
      'Вы',
      `Могу взять заявку «${post.title}» (${post.service_type}, ${post.schedule}).`,
      'сейчас',
    ]);
    setActiveTab('chat');
    await refresh();
  }

  async function addMessage() {
    if (!messageDraft.trim()) return;
    const db = await getDatabase();
    await db.runAsync('INSERT INTO messages (thread, author, text, created_at) VALUES (?, ?, ?, ?)', [
      'marta-sam',
      role === 'owner' ? 'Вы' : 'Выгульщик',
      messageDraft.trim(),
      'сейчас',
    ]);
    setMessageDraft('');
    await refresh();
  }

  async function addPost() {
    const db = await getDatabase();
    const dogName = newPostPetName.trim() || 'Питомец';
    const dogResult = await db.runAsync('INSERT INTO dogs (owner_id, name, breed, age, temperament, photo) VALUES (?, ?, ?, ?, ?, ?)', [
      4,
      dogName,
      service === 'Котоняня' ? 'кошка или другой питомец' : 'собака',
      'уточнить',
      newPostNotes.trim() || 'подробности в заявке',
      dogPhotos[data.dogs.length % dogPhotos.length],
    ]);
    await db.runAsync('INSERT INTO posts (dog_id, city, title, service_type, schedule, budget, status, address, notes, urgency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      dogResult.lastInsertRowId,
      city === 'Любая локация' ? 'Санкт-Петербург' : city,
      newPostTitle.trim() || 'Нужен выгульщик',
      service,
      newPostSchedule.trim() || (service === 'Регулярная' ? 'каждую неделю' : 'ближайшее удобное время'),
      Number(newPostBudget) || (service === 'Зоотакси' ? 1800 : service === 'Котоняня' ? 1200 : 900),
      'open',
      newPostAddress.trim(),
      newPostNotes.trim(),
      service === 'Разовая' ? 'soon' : 'normal',
    ]);
    setNewPostTitle('Нужен выгул на этой неделе');
    setNewPostPetName('Сэм');
    setNewPostSchedule('сегодня вечером');
    setNewPostAddress('');
    setNewPostNotes('');
    setNewPostBudget(service === 'Зоотакси' ? '1800' : service === 'Котоняня' ? '1200' : '900');
    await refresh();
  }

  function sendVerificationCode() {
    if (profilePhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Телефон', 'Введите номер телефона для подтверждения.');
      return;
    }
    setVerificationSent(true);
    setProfileCode('2486');
    Alert.alert('Код подтверждения', 'Для прототипа используйте код 2486.');
  }

  async function registerProfile() {
    if (profilePhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Телефон', 'Нужен номер телефона для регистрации.');
      return;
    }
    if (profileCode.trim() !== '2486') {
      Alert.alert('Подтверждение телефона', 'Введите код 2486 после отправки SMS.');
      return;
    }
    const name = profileName.trim() || (role === 'owner' ? 'Новый хозяин' : 'Новый выгульщик');
    const about = profileAbout.trim() || (role === 'owner' ? 'Профиль хозяина и питомца.' : 'Готов брать прогулки в выбранной локации.');
    const db = await getDatabase();
    const result = await db.runAsync('INSERT INTO users (name, role, city, avatar, about, phone, phone_verified, verification_code, partner_requested, contract_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      name,
      role,
      city === 'Любая локация' ? 'Санкт-Петербург' : city,
      role === 'owner' ? dogPhotos[1] : 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=500&q=80',
      about,
      profilePhone.trim(),
      1,
      '2486',
      role === 'walker' && partnerRequested ? 1 : 0,
      role === 'walker' && partnerRequested ? 'contract_requested' : 'none',
    ]);
    if (role === 'walker') {
      await db.runAsync('INSERT INTO walkers (user_id, rating, reviews_count, price_walk, price_taxi, tags, radius, repeat_clients) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        result.lastInsertRowId,
        5,
        0,
        800,
        1700,
        'новый профиль, прогулки, зоотакси',
        'по договоренности',
        0,
      ]);
    }
    setProfileName('');
    setProfilePhone('');
    setProfileCode('');
    setVerificationSent(false);
    setPartnerRequested(false);
    setProfileAbout('');
    await refresh();
  }

  if (!fontsLoaded || !ready || !data) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#176B5B" />
        <Text style={styles.loadingText}>Готовим Pawgo и базу прогулок</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.app, isDesktop && styles.appDesktop]}>
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View>
            <Text style={styles.logo}>Pawgo</Text>
            <Text style={styles.subtitle}>Санкт-Петербург и другие города</Text>
          </View>
          <Pressable onPress={() => setCityPickerOpen(true)} style={styles.dbBadge}>
            <Ionicons name="location-outline" size={18} color="#161616" />
            <Text style={styles.dbBadgeText}>{city === 'Любая локация' ? 'Везде' : city.split('-')[0]}</Text>
            <Ionicons name="chevron-down" size={15} color="#161616" />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleBar} contentContainerStyle={[styles.roleBarContent, isDesktop && styles.roleBarContentDesktop]}>
          <Pill label="Я хозяин" active={role === 'owner'} onPress={() => setRole('owner')} />
          <Pill label="Я выгульщик" active={role === 'walker'} onPress={() => setRole('walker')} />
        </ScrollView>

        <ScrollView style={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
          {activeTab === 'feed' ? (
            <>
              <SectionTitle eyebrow="Формат заботы" title="Что нужно питомцу?" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.serviceRow, isDesktop && styles.serviceRowDesktop]}>
                {serviceOptions.map((item) => (
                  <ServiceTile key={item} label={item} active={service === item} onPress={() => setService(item)} />
                ))}
              </ScrollView>
              {role === 'owner' ? (
                <>
                  <SectionTitle eyebrow={city} title="Подходящие люди" action={`${visibleFeedWalkers.length} доступно`} />
                  <View style={[styles.walkerList, isDesktop && styles.desktopGrid]}>
                    {visibleFeedWalkers.map((walker) => (
                      <WalkerCard
                        key={walker.id}
                        walker={walker}
                        slots={data.availability.filter((slot) => slot.walker_id === walker.id)}
                        style={isDesktop && styles.desktopGridItem}
                        onBook={openBooking}
                        onFocus={() => {
                          setSelectedWalkerId(walker.id);
                          setActiveTab('calendar');
                        }}
                      />
                    ))}
                  </View>
                  {visibleFeedWalkers.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>В этой локации пока нет профилей</Text>
                      <Text style={styles.muted}>Выберите другую локацию или формат услуги.</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <SectionTitle eyebrow={city} title="Заявки хозяев" action={`${visiblePosts.length} доступно`} />
                  <View style={[styles.requestList, isDesktop && styles.desktopGrid]}>
                    {visiblePosts.map((post) => (
                      <RequestCard key={post.id} post={post} style={isDesktop && styles.desktopGridItem} onPress={() => respondToPost(post)} />
                    ))}
                  </View>
                  {visiblePosts.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>Под этот фильтр заявок нет</Text>
                      <Text style={styles.muted}>Смените город или формат услуги.</Text>
                    </View>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {activeTab === 'calendar' && selectedWalker ? (
            <>
              <SectionTitle
                eyebrow={role === 'walker' ? 'Мой календарь' : 'Свободные окна'}
                title={role === 'walker' ? 'Планы и заявки' : selectedWalker.name}
                action={role === 'walker' ? `${data.bookings.length} броней` : `★ ${selectedWalker.rating}`}
              />
              <View style={styles.calendarPanel}>
                <View style={styles.walkerTop}>
                  <Image source={{ uri: selectedWalker.avatar }} style={styles.avatarLarge} />
                  <View style={styles.walkerMain}>
                    <Text style={styles.cardTitle}>{selectedWalker.name}</Text>
                    <Text style={styles.muted}>{selectedWalker.radius}</Text>
                    <Text style={styles.about}>{selectedWalker.about}</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarSlots}>
                  {selectedSlots.map((slot) => {
                    const conflict = findScheduleConflict(data.bookings, selectedWalker.id, slot.day, slot.time);
                    const isSelected = selectedSlotIds.includes(slot.id);
                    return (
                      <Pressable
                        key={slot.id}
                        disabled={Boolean(conflict) && role !== 'walker'}
                        onPress={() => toggleSlot(slot)}
                        style={[styles.calendarSlot, isSelected && styles.calendarSlotSelected, conflict && styles.calendarSlotBusy]}
                      >
                        <Text style={[styles.calendarDay, conflict && styles.calendarBusyText]}>{slot.day}</Text>
                        <Text style={[styles.calendarTime, conflict && styles.calendarBusyText]}>{slot.time}</Text>
                        <Text style={[styles.calendarType, conflict && styles.calendarBusyAccent]}>{conflict ? 'занято рядом' : isSelected ? 'выбрано' : slot.slot_type}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.calendarRule}>В один день можно брать несколько прогулок, если между слотами одного выгульщика есть минимум {minTransferMinutes} минут на дорогу.</Text>
                {role === 'owner' ? (
                  <>
                    <Text style={styles.panelLabel}>Формат бронирования</Text>
                    <View style={styles.gridTwo}>
                      {serviceOptions.map((item) => (
                        <Pressable key={item} onPress={() => setService(item)} style={[styles.optionCard, service === item && styles.optionCardActive]}>
                          <Text style={[styles.optionTitle, service === item && styles.optionTitleActive]}>{item}</Text>
                          <Text style={styles.optionCopy}>
                            {item === 'Регулярная'
                              ? 'каждый день или выбранные дни'
                              : item === 'Зоотакси'
                                ? 'поездка к врачу, грумеру или на передержку'
                                : item === 'Котоняня'
                                  ? 'приход домой: корм, вода, лоток и фотоотчет'
                                  : item === 'Утро + вечер'
                                    ? 'два выхода в день'
                                    : 'один слот без подписки'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.panelLabel}>Детали для исполнителя</Text>
                    <TextInput
                      value={bookingAddress}
                      onChangeText={setBookingAddress}
                      placeholder="Адрес или район старта"
                      placeholderTextColor="#8B918C"
                      style={styles.input}
                    />
                    <TextInput
                      value={bookingNotes}
                      onChangeText={setBookingNotes}
                      placeholder="Комментарий: ключи, шлейка, особенности питомца"
                      placeholderTextColor="#8B918C"
                      style={[styles.input, styles.textArea]}
                      multiline
                    />
                    <Pressable onPress={continueBooking} style={[styles.primaryButton, selectedBookingSlots.length === 0 && styles.primaryButtonDisabled]}>
                      <Text style={styles.primaryButtonText}>
                        {selectedBookingSlots.length > 0 ? `Продолжить бронь (${selectedBookingSlots.length})` : 'Выберите время'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.panelLabel}>Планы на ближайшее время</Text>
                    {data.bookings.map((booking) => (
                      <View key={booking.id} style={styles.bookingRow}>
                        <Text style={styles.bookingTitle}>{booking.service_type}</Text>
                        <Text style={styles.muted}>{booking.schedule}</Text>
                        <Text style={styles.status}>{booking.status}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>

              {role === 'owner' ? (
                <>
                  <SectionTitle title="Активные брони" />
                  {data.bookings.map((booking) => (
                    <View key={booking.id} style={styles.bookingRow}>
                      <Text style={styles.bookingTitle}>{booking.service_type}</Text>
                      <Text style={styles.muted}>{booking.schedule}</Text>
                      <Text style={styles.status}>{booking.status}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {activeTab === 'requests' ? (
            <>
              <SectionTitle eyebrow="Объявления хозяев" title="Питомцы ищут выгул" action={`${visiblePosts.length} заявок`} />
              <View style={styles.composeCard}>
                <Text style={styles.panelLabel}>Оформление заявки</Text>
                <TextInput
                  value={newPostTitle}
                  onChangeText={setNewPostTitle}
                  placeholder="Что нужно сделать"
                  placeholderTextColor="#8B918C"
                  style={styles.input}
                />
                <View style={styles.gridTwo}>
                  <TextInput
                    value={newPostPetName}
                    onChangeText={setNewPostPetName}
                    placeholder="Имя питомца"
                    placeholderTextColor="#8B918C"
                    style={[styles.input, styles.halfInput]}
                  />
                  <TextInput
                    value={newPostBudget}
                    onChangeText={setNewPostBudget}
                    placeholder="Бюджет, ₽"
                    placeholderTextColor="#8B918C"
                    keyboardType="numeric"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>
                <TextInput
                  value={newPostSchedule}
                  onChangeText={setNewPostSchedule}
                  placeholder="Когда и как часто"
                  placeholderTextColor="#8B918C"
                  style={styles.input}
                />
                <TextInput
                  value={newPostAddress}
                  onChangeText={setNewPostAddress}
                  placeholder="Адрес или район"
                  placeholderTextColor="#8B918C"
                  style={styles.input}
                />
                <TextInput
                  value={newPostNotes}
                  onChangeText={setNewPostNotes}
                  placeholder="Особенности питомца, доступ, пожелания"
                  placeholderTextColor="#8B918C"
                  style={[styles.input, styles.textArea]}
                  multiline
                />
                <View style={styles.rowBetween}>
                  <Text style={styles.mutedSmall}>{city} · {service}</Text>
                  <Pressable onPress={addPost} style={styles.primaryButtonSmall}>
                    <Text style={styles.primaryButtonText}>Опубликовать</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.requestList, isDesktop && styles.desktopGrid]}>
              {visiblePosts.map((post) => (
                <RequestCard key={post.id} post={post} style={isDesktop && styles.desktopGridItem} onPress={() => respondToPost(post)} />
              ))}
              </View>
            </>
          ) : null}

          {activeTab === 'chat' ? (
            <>
              <SectionTitle eyebrow="Встроенный мессенджер" title="Марта · Сэм" action="онлайн" />
              <View style={styles.chatPanel}>
                {data.messages.map((message) => (
                  <View key={message.id} style={[styles.messageBubble, message.author === 'Вы' && styles.messageMine]}>
                    <Text style={[styles.messageAuthor, message.author === 'Вы' && styles.messageMineText]}>{message.author}</Text>
                    <Text style={[styles.messageText, message.author === 'Вы' && styles.messageMineText]}>{message.text}</Text>
                    <Text style={[styles.messageTime, message.author === 'Вы' && styles.messageMineText]}>{message.created_at}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.chatInputRow}>
                <TextInput
                  value={messageDraft}
                  onChangeText={setMessageDraft}
                  placeholder="Написать сообщение"
                  placeholderTextColor="#8B918C"
                  style={styles.chatInput}
                />
                <Pressable onPress={addMessage} style={styles.sendButton}>
                  <Text style={styles.sendButtonText}>↑</Text>
                </Pressable>
              </View>

              <SectionTitle title="Отзывы" />
              {data.reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>{review.author}</Text>
                    <Text style={styles.rating}>★ {review.rating}</Text>
                  </View>
                  <Text style={styles.mutedSmall}>{review.target_type === 'walker' ? 'о выгульщике' : 'о собаке и хозяине'}</Text>
                  <Text style={styles.about}>{review.text}</Text>
                </View>
              ))}
            </>
          ) : null}

          {activeTab === 'profile' ? (
            <>
              <SectionTitle eyebrow="Регистрация" title={role === 'owner' ? 'Профиль хозяина' : 'Профиль выгульщика'} />
              <View style={styles.profilePanel}>
                <Text style={styles.panelLabel}>Имя</Text>
                <TextInput value={profileName} onChangeText={setProfileName} placeholder="Как вас показать в Pawgo" placeholderTextColor="#8B918C" style={styles.input} />
                <Text style={styles.panelLabel}>Телефон</Text>
                <View style={styles.phoneRow}>
                  <TextInput
                    value={profilePhone}
                    onChangeText={setProfilePhone}
                    placeholder="+7 999 123-45-67"
                    placeholderTextColor="#8B918C"
                    keyboardType="phone-pad"
                    style={[styles.input, styles.phoneInput]}
                  />
                  <Pressable onPress={sendVerificationCode} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Код</Text>
                  </Pressable>
                </View>
                <TextInput
                  value={profileCode}
                  onChangeText={setProfileCode}
                  placeholder={verificationSent ? 'Введите код из SMS' : 'Сначала отправьте код'}
                  placeholderTextColor="#8B918C"
                  keyboardType="number-pad"
                  style={styles.input}
                />
                {role === 'walker' ? (
                  <Pressable onPress={() => setPartnerRequested((value) => !value)} style={styles.checkboxRow}>
                    <View style={[styles.checkbox, partnerRequested && styles.checkboxActive]}>
                      {partnerRequested ? <Ionicons name="checkmark" size={16} color="#161616" /> : null}
                    </View>
                    <View style={styles.walkerMain}>
                      <Text style={styles.cardTitle}>Стать партнером Pawgo</Text>
                      <Text style={styles.muted}>Запрос на прямой договор, проверку документов и приоритет в выдаче.</Text>
                    </View>
                  </Pressable>
                ) : null}
                <Text style={styles.panelLabel}>Описание</Text>
                <TextInput
                  value={profileAbout}
                  onChangeText={setProfileAbout}
                  placeholder={role === 'owner' ? 'Расскажите о питомце и привычках' : 'Опыт, районы, породы, свободное время'}
                  placeholderTextColor="#8B918C"
                  style={[styles.input, styles.textArea]}
                  multiline
                />
                <Pressable onPress={registerProfile} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{role === 'walker' ? 'Зарегистрироваться исполнителем' : 'Зарегистрироваться заказчиком'}</Text>
                </Pressable>
              </View>

              <SectionTitle title="Недавние профили" />
              {data.users.slice(0, 5).map((user) => (
                <View key={user.id} style={styles.userRow}>
                  <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                  <View style={styles.walkerMain}>
                    <Text style={styles.cardTitle}>{user.name}</Text>
                    <Text style={styles.muted}>{user.role === 'owner' ? 'хозяин' : 'выгульщик'} · {user.city}</Text>
                    <Text style={styles.about}>{user.about}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={[styles.tabBar, isDesktop && styles.tabBarDesktop]}>
          {tabs.map((tab) => (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}>
              <Ionicons name={tab.icon} size={22} color={activeTab === tab.id ? '#161616' : '#FFFFFF'} />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
        <Modal transparent visible={cityPickerOpen} animationType="fade" onRequestClose={() => setCityPickerOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setCityPickerOpen(false)}>
            <Pressable style={[styles.cityPicker, isDesktop && styles.cityPickerDesktop]}>
              <View style={styles.cityPickerHeader}>
                <Text style={styles.cityPickerTitle}>Локация</Text>
                <Pressable onPress={() => setCityPickerOpen(false)} style={styles.cityPickerClose}>
                  <Ionicons name="close" size={18} color="#161616" />
                </Pressable>
              </View>
              {cityOptions.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setCity(item);
                    setCityPickerOpen(false);
                  }}
                  style={[styles.cityOption, city === item && styles.cityOptionActive]}
                >
                  <Text style={[styles.cityOptionText, city === item && styles.cityOptionTextActive]}>{item}</Text>
                  {city === item ? <Ionicons name="checkmark" size={18} color="#161616" /> : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  app: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F4EE',
  },
  loadingText: {
    marginTop: 12,
    color: '#52615A',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: '#17211D',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#65726D',
    fontSize: 13,
    marginTop: 2,
  },
  dbBadge: {
    backgroundColor: '#DDECE5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  dbBadgeText: {
    color: '#176B5B',
    fontWeight: '800',
    fontSize: 12,
  },
  roleBar: {
    maxHeight: 48,
  },
  roleBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E0D7',
  },
  pillActive: {
    backgroundColor: '#17211D',
    borderColor: '#17211D',
  },
  pillDark: {
    backgroundColor: '#EEF3F1',
    borderColor: '#D6E3DE',
  },
  pillText: {
    color: '#52615A',
    fontWeight: '700',
    fontSize: 13,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillTextDark: {
    color: '#176B5B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  hero: {
    minHeight: 186,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#17211D',
    marginBottom: 22,
    flexDirection: 'row',
  },
  heroText: {
    flex: 1.1,
    padding: 20,
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29,
    letterSpacing: 0,
  },
  heroCopy: {
    color: '#DDECE5',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
  },
  heroImage: {
    flex: 0.85,
    height: '100%',
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    marginTop: 4,
  },
  eyebrow: {
    color: '#B86834',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  h2: {
    color: '#17211D',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#176B5B',
    fontWeight: '800',
    fontSize: 13,
  },
  serviceRow: {
    gap: 8,
    paddingBottom: 12,
  },
  walkerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECE6DC',
  },
  walkerTop: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#E5E0D7',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#E5E0D7',
  },
  walkerMain: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    color: '#17211D',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#B86834',
    fontWeight: '900',
    fontSize: 14,
  },
  muted: {
    color: '#65726D',
    fontSize: 13,
    lineHeight: 18,
  },
  mutedSmall: {
    color: '#7C8580',
    fontSize: 12,
    lineHeight: 16,
  },
  about: {
    color: '#31423B',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 6,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  tag: {
    backgroundColor: '#F4ECE2',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: '#8A522F',
    fontSize: 12,
    fontWeight: '700',
  },
  slotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  slotChip: {
    flex: 1,
    backgroundColor: '#F5F8F6',
    borderRadius: 16,
    padding: 10,
  },
  slotDay: {
    color: '#65726D',
    fontSize: 12,
    fontWeight: '700',
  },
  slotTime: {
    color: '#17211D',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEAE2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    color: '#17211D',
    fontWeight: '900',
    fontSize: 19,
  },
  primaryButtonSmall: {
    backgroundColor: '#176B5B',
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#176B5B',
    height: 52,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ECE6DC',
  },
  emptyTitle: {
    color: '#17211D',
    fontWeight: '900',
    fontSize: 17,
    marginBottom: 4,
  },
  calendarPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    marginBottom: 18,
  },
  calendarSlots: {
    gap: 10,
    paddingVertical: 16,
  },
  calendarSlot: {
    width: 104,
    backgroundColor: '#17211D',
    borderRadius: 22,
    padding: 14,
  },
  calendarDay: {
    color: '#DDECE5',
    fontWeight: '800',
    fontSize: 13,
  },
  calendarTime: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 22,
    marginTop: 8,
  },
  calendarType: {
    color: '#F1B36B',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 8,
  },
  calendarSlotBusy: {
    backgroundColor: '#E7E1D7',
    borderWidth: 1,
    borderColor: '#D8CFC2',
  },
  calendarBusyText: {
    color: '#81786E',
  },
  calendarBusyAccent: {
    color: '#9A5E3D',
  },
  calendarRule: {
    color: '#65726D',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  panelLabel: {
    color: '#52615A',
    fontWeight: '900',
    fontSize: 13,
    marginBottom: 8,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    width: '48%',
    minHeight: 96,
    backgroundColor: '#F8F6F1',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE6DC',
  },
  optionCardActive: {
    backgroundColor: '#DDECE5',
    borderColor: '#176B5B',
  },
  optionTitle: {
    color: '#17211D',
    fontWeight: '900',
    fontSize: 15,
  },
  optionTitleActive: {
    color: '#176B5B',
  },
  optionCopy: {
    color: '#65726D',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  bookingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookingTitle: {
    color: '#17211D',
    fontWeight: '900',
    fontSize: 15,
  },
  status: {
    color: '#B86834',
    fontWeight: '900',
    fontSize: 12,
  },
  composeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    marginBottom: 14,
  },
  input: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: '#F8F6F1',
    paddingHorizontal: 14,
    color: '#17211D',
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    flexDirection: 'row',
    gap: 12,
  },
  dogPhoto: {
    width: 94,
    minHeight: 120,
    borderRadius: 20,
    backgroundColor: '#E5E0D7',
  },
  requestBody: {
    flex: 1,
    paddingVertical: 3,
  },
  budget: {
    color: '#176B5B',
    fontSize: 15,
    fontWeight: '900',
  },
  inlineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  inlineText: {
    backgroundColor: '#EEF3F1',
    color: '#176B5B',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
  },
  chatPanel: {
    gap: 10,
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    alignSelf: 'flex-start',
  },
  messageMine: {
    backgroundColor: '#176B5B',
    borderColor: '#176B5B',
    alignSelf: 'flex-end',
  },
  messageAuthor: {
    color: '#176B5B',
    fontWeight: '900',
    fontSize: 12,
    marginBottom: 4,
  },
  messageText: {
    color: '#17211D',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: '#7C8580',
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  messageMineText: {
    color: '#FFFFFF',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  chatInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    color: '#17211D',
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#17211D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    marginBottom: 10,
  },
  profilePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    marginBottom: 16,
  },
  userRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECE6DC',
    flexDirection: 'row',
    gap: 12,
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E5E0D7',
  },
  tabBar: {
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 4 : 10,
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E8E0D5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    shadowColor: '#17211D',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  tabItemActive: {
    backgroundColor: '#EEF3F1',
  },
  tabIcon: {
    color: '#7C8580',
    fontSize: 18,
    fontWeight: '900',
    height: 21,
  },
  tabText: {
    color: '#7C8580',
    fontWeight: '800',
    fontSize: 11,
    marginTop: 2,
  },
  tabTextActive: {
    color: '#176B5B',
  },
  safe: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F9',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 1,
  },
  dbBadge: {
    minHeight: 34,
    maxWidth: 142,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  dbBadgeText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 12,
  },
  roleBar: {
    maxHeight: 44,
  },
  roleBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  pillActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pillDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5EA',
  },
  pillText: {
    color: '#3A3A3C',
    fontWeight: '600',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  pillTextDark: {
    color: '#3A3A3C',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  hero: {
    minHeight: 112,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  searchLine: {
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchText: {
    color: '#3A3A3C',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 14,
  },
  heroNumber: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  heroLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    marginTop: 2,
  },
  eyebrow: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none',
  },
  h2: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 14,
  },
  walkerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  avatarLarge: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
  },
  cardTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#FF9500',
    fontWeight: '800',
    fontSize: 14,
  },
  muted: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
  },
  mutedSmall: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
  },
  about: {
    color: '#3A3A3C',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 5,
  },
  tag: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  tagText: {
    color: '#3A3A3C',
    fontSize: 12,
    fontWeight: '600',
  },
  slotChip: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  slotDay: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  slotTime: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 18,
  },
  primaryButtonSmall: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  calendarPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 16,
  },
  calendarSlot: {
    width: 96,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 12,
  },
  calendarDay: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
    fontSize: 13,
  },
  calendarTime: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 21,
    marginTop: 7,
  },
  calendarType: {
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 7,
  },
  calendarSlotBusy: {
    backgroundColor: '#E5E5EA',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
  },
  calendarBusyText: {
    color: '#8E8E93',
  },
  calendarBusyAccent: {
    color: '#8E8E93',
  },
  calendarRule: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  optionCard: {
    width: '48%',
    minHeight: 94,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  optionCardActive: {
    backgroundColor: '#EAF4FF',
    borderColor: '#007AFF',
  },
  optionTitleActive: {
    color: '#007AFF',
  },
  composeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 12,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 16,
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    gap: 12,
  },
  dogPhoto: {
    width: 86,
    minHeight: 112,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
  },
  budget: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '800',
  },
  inlineText: {
    backgroundColor: '#F2F2F7',
    color: '#3A3A3C',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
  },
  messageBubble: {
    maxWidth: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  messageMine: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  messageAuthor: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  chatInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    color: '#111827',
    fontSize: 16,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 10,
  },
  profilePanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 14,
  },
  userRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    flexDirection: 'row',
    gap: 12,
  },
  tabBar: {
    marginHorizontal: 10,
    marginBottom: Platform.OS === 'ios' ? 4 : 10,
    minHeight: 64,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  tabItemActive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    color: '#8E8E93',
    fontWeight: '600',
    fontSize: 11,
    marginTop: 2,
  },
  tabTextActive: {
    color: '#007AFF',
  },
  safe: {
    flex: 1,
    backgroundColor: '#F6F2EA',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F2EA',
  },
  loadingText: {
    marginTop: 12,
    color: '#7B8178',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#242B24',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#85897F',
    fontSize: 14,
    marginTop: 3,
  },
  dbBadge: {
    minHeight: 38,
    maxWidth: 150,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2DCCF',
  },
  dbBadgeText: {
    color: '#6F8F72',
    fontWeight: '700',
    fontSize: 12,
  },
  roleBar: {
    maxHeight: 48,
  },
  roleBarContent: {
    paddingHorizontal: 18,
    gap: 10,
  },
  pill: {
    height: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,248,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0D8C8',
  },
  pillActive: {
    backgroundColor: '#DCE9D8',
    borderColor: '#B8CBAE',
  },
  pillDark: {
    backgroundColor: 'rgba(255,253,248,0.82)',
    borderColor: '#E0D8C8',
  },
  pillText: {
    color: '#62685F',
    fontWeight: '600',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#3F6849',
  },
  pillTextDark: {
    color: '#62685F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  hero: {
    minHeight: 132,
    borderRadius: 26,
    backgroundColor: '#FFFDF8',
    marginBottom: 26,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    shadowColor: '#4E5B49',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  searchLine: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1EDE4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 9,
  },
  searchText: {
    color: '#4B5149',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 20,
  },
  heroNumber: {
    color: '#242B24',
    fontSize: 24,
    fontWeight: '800',
  },
  heroLabel: {
    color: '#85897F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    marginTop: 8,
  },
  eyebrow: {
    color: '#9B7B5C',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none',
  },
  h2: {
    color: '#242B24',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#6F8F72',
    fontWeight: '700',
    fontSize: 14,
  },
  serviceRow: {
    gap: 10,
    paddingBottom: 18,
  },
  walkerCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    shadowColor: '#4E5B49',
    shadowOpacity: 0.035,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  walkerTop: {
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#DED8CC',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#DED8CC',
  },
  cardTitle: {
    color: '#242B24',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#B8845C',
    fontWeight: '800',
    fontSize: 14,
  },
  muted: {
    color: '#85897F',
    fontSize: 13,
    lineHeight: 19,
  },
  mutedSmall: {
    color: '#85897F',
    fontSize: 12,
    lineHeight: 17,
  },
  about: {
    color: '#4B5149',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tag: {
    backgroundColor: '#EEF3EA',
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  tagText: {
    color: '#607866',
    fontSize: 12,
    fontWeight: '600',
  },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  slotChip: {
    flex: 1,
    backgroundColor: '#F7F4EC',
    borderRadius: 18,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
  },
  slotDay: {
    color: '#85897F',
    fontSize: 12,
    fontWeight: '600',
  },
  slotTime: {
    color: '#242B24',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  cardFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E1D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    color: '#242B24',
    fontWeight: '800',
    fontSize: 18,
  },
  primaryButtonSmall: {
    backgroundColor: '#6F8F72',
    paddingHorizontal: 17,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#6F8F72',
    height: 52,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryButtonText: {
    color: '#FFFDF8',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
  },
  emptyTitle: {
    color: '#242B24',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 5,
  },
  calendarPanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    marginBottom: 22,
  },
  calendarSlots: {
    gap: 12,
    paddingVertical: 18,
  },
  calendarSlot: {
    width: 106,
    backgroundColor: '#6F8F72',
    borderRadius: 22,
    padding: 14,
  },
  calendarDay: {
    color: 'rgba(255,253,248,0.84)',
    fontWeight: '700',
    fontSize: 13,
  },
  calendarTime: {
    color: '#FFFDF8',
    fontWeight: '800',
    fontSize: 22,
    marginTop: 8,
  },
  calendarType: {
    color: 'rgba(255,253,248,0.86)',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 8,
  },
  calendarSlotBusy: {
    backgroundColor: '#E7E1D4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D4CAB8',
  },
  calendarBusyText: {
    color: '#85897F',
  },
  calendarBusyAccent: {
    color: '#9B7B5C',
  },
  calendarRule: {
    color: '#85897F',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  panelLabel: {
    color: '#6C7168',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 10,
  },
  gridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '48%',
    minHeight: 104,
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
  },
  optionCardActive: {
    backgroundColor: '#EEF3EA',
    borderColor: '#B8CBAE',
  },
  optionTitle: {
    color: '#242B24',
    fontWeight: '800',
    fontSize: 15,
  },
  optionTitleActive: {
    color: '#4F7658',
  },
  optionCopy: {
    color: '#70776E',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  bookingRow: {
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  status: {
    color: '#9B7B5C',
    fontWeight: '800',
    fontSize: 12,
  },
  composeCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    marginBottom: 16,
  },
  input: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: '#F1EDE4',
    paddingHorizontal: 14,
    color: '#242B24',
    fontSize: 16,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 112,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  requestCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    flexDirection: 'row',
    gap: 14,
  },
  dogPhoto: {
    width: 92,
    minHeight: 122,
    borderRadius: 22,
    backgroundColor: '#DED8CC',
  },
  budget: {
    color: '#6F8F72',
    fontSize: 15,
    fontWeight: '800',
  },
  inlineMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  inlineText: {
    backgroundColor: '#EEF3EA',
    color: '#607866',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 15,
  },
  chatPanel: {
    gap: 12,
    marginBottom: 16,
  },
  messageBubble: {
    maxWidth: '84%',
    backgroundColor: '#FFFDF8',
    borderRadius: 24,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    alignSelf: 'flex-start',
  },
  messageMine: {
    backgroundColor: '#6F8F72',
    borderColor: '#6F8F72',
    alignSelf: 'flex-end',
  },
  messageAuthor: {
    color: '#6F8F72',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 5,
  },
  messageText: {
    color: '#242B24',
    fontSize: 15,
    lineHeight: 21,
  },
  messageTime: {
    color: '#85897F',
    fontSize: 11,
    marginTop: 7,
    alignSelf: 'flex-end',
  },
  messageMineText: {
    color: '#FFFDF8',
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  chatInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    color: '#242B24',
    fontSize: 16,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6F8F72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 24,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    marginBottom: 12,
  },
  profilePanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 26,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    marginBottom: 18,
  },
  userRow: {
    backgroundColor: '#FFFDF8',
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    flexDirection: 'row',
    gap: 14,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#DED8CC',
  },
  tabBar: {
    marginHorizontal: 14,
    marginBottom: Platform.OS === 'ios' ? 6 : 12,
    minHeight: 70,
    backgroundColor: 'rgba(255,253,248,0.94)',
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0D8C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 7,
    shadowColor: '#4E5B49',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  tabText: {
    color: '#A3A59F',
    fontWeight: '600',
    fontSize: 11,
    marginTop: 3,
  },
  tabTextActive: {
    color: '#6F8F72',
  },
  safe: {
    flex: 1,
    backgroundColor: '#F8F0E4',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F0E4',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: '#293127',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#7E8E6C',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  dbBadge: {
    minHeight: 42,
    maxWidth: 150,
    backgroundColor: '#FFF9EE',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0,
    shadowColor: '#7A654B',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  dbBadgeText: {
    color: '#789264',
    fontWeight: '800',
    fontSize: 12,
  },
  roleBarContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  pill: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9EE',
    borderWidth: 0,
  },
  pillActive: {
    backgroundColor: '#2F3A2E',
    borderColor: '#2F3A2E',
  },
  pillDark: {
    backgroundColor: '#FFF9EE',
    borderColor: '#FFF9EE',
  },
  pillText: {
    color: '#6E7668',
    fontWeight: '800',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#FFF9EE',
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: 10,
  },
  eyebrow: {
    color: '#7E8E6C',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'none',
  },
  h2: {
    color: '#293127',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#E28A58',
    fontWeight: '900',
    fontSize: 14,
  },
  serviceRow: {
    gap: 14,
    paddingBottom: 28,
  },
  serviceTile: {
    width: 138,
    minHeight: 144,
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 16,
    borderWidth: 0,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  serviceTileActive: {
    backgroundColor: '#2F3A2E',
    borderColor: '#2F3A2E',
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  serviceTitle: {
    color: '#293127',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
  serviceText: {
    color: '#7B8178',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  walkerCard: {
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 23,
    backgroundColor: '#E4D9C8',
  },
  avatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 27,
    backgroundColor: '#E4D9C8',
  },
  cardTitle: {
    color: '#293127',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#E28A58',
    fontWeight: '900',
    fontSize: 14,
  },
  about: {
    color: '#687064',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  tag: {
    backgroundColor: '#F6E6D7',
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    color: '#B36E45',
    fontSize: 12,
    fontWeight: '800',
  },
  slotChip: {
    flex: 1,
    backgroundColor: '#F4EBDD',
    borderRadius: 22,
    padding: 13,
    borderWidth: 0,
  },
  primaryButtonSmall: {
    backgroundColor: '#2F3A2E',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2F3A2E',
    height: 56,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  calendarPanel: {
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 20,
    borderWidth: 0,
    marginBottom: 24,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  calendarSlot: {
    width: 112,
    backgroundColor: '#2F3A2E',
    borderRadius: 28,
    padding: 16,
  },
  composeCard: {
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 20,
    borderWidth: 0,
    marginBottom: 20,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  input: {
    minHeight: 52,
    borderRadius: 24,
    backgroundColor: '#F4EBDD',
    paddingHorizontal: 16,
    color: '#293127',
    fontSize: 16,
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 13,
    marginBottom: 18,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 15,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  dogPhoto: {
    width: 96,
    minHeight: 128,
    borderRadius: 28,
    backgroundColor: '#E4D9C8',
  },
  inlineText: {
    backgroundColor: '#EAF1DB',
    color: '#789264',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 17,
  },
  profilePanel: {
    backgroundColor: '#FFF9EE',
    borderRadius: 36,
    padding: 20,
    borderWidth: 0,
    marginBottom: 22,
    shadowColor: '#7A654B',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  tabBar: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 8 : 14,
    minHeight: 74,
    backgroundColor: 'rgba(255,249,238,0.96)',
    borderRadius: 34,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#7A654B',
    shadowOpacity: 0.11,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  tabTextActive: {
    color: '#2F3A2E',
  },
  hero: {
    minHeight: 250,
    borderRadius: 34,
    backgroundColor: '#FDF7EA',
    marginBottom: 28,
    padding: 18,
    borderWidth: 0,
    shadowColor: '#6C614C',
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 3,
  },
  searchLine: {
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,253,248,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(226,220,207,0.8)',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 20,
  },
  heroCopyBlock: {
    flex: 1,
    paddingLeft: 2,
  },
  heroKicker: {
    color: '#8B9D75',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroHeadline: {
    color: '#2B3027',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: 0,
  },
  heroSubline: {
    color: '#787D71',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
  },
  heroPetWrap: {
    width: 116,
    height: 130,
    borderRadius: 34,
    backgroundColor: '#DCE9D8',
    padding: 8,
    transform: [{ rotate: '3deg' }],
  },
  heroPet: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 20,
  },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,253,248,0.78)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  heroNumber: {
    color: '#2B3027',
    fontSize: 24,
    fontWeight: '800',
  },
  heroLabel: {
    color: '#85897F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  serviceRow: {
    gap: 12,
    paddingBottom: 24,
  },
  serviceTile: {
    width: 126,
    minHeight: 128,
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    shadowColor: '#6C614C',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  serviceTileActive: {
    backgroundColor: '#EEF3EA',
    borderColor: '#B8CBAE',
  },
  serviceIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  serviceTitle: {
    color: '#2B3027',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  serviceText: {
    color: '#85897F',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  walkerCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 18,
    marginBottom: 18,
    borderWidth: 0,
    shadowColor: '#6C614C',
    shadowOpacity: 0.055,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  requestCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 12,
    marginBottom: 16,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 14,
    shadowColor: '#6C614C',
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  calendarPanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 18,
    borderWidth: 0,
    marginBottom: 24,
    shadowColor: '#6C614C',
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  composeCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 18,
    borderWidth: 0,
    marginBottom: 18,
    shadowColor: '#6C614C',
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  profilePanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 30,
    padding: 18,
    borderWidth: 0,
    marginBottom: 20,
    shadowColor: '#6C614C',
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  primaryButtonSmall: {
    backgroundColor: '#4F7658',
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4F7658',
    height: 54,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#7B8178',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  logo: {
    fontSize: 38,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    color: '#293127',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#7E8E6C',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bold,
    marginTop: 3,
  },
  dbBadgeText: {
    color: '#789264',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 12,
  },
  pillText: {
    color: '#6E7668',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  eyebrow: {
    color: '#7E8E6C',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    textTransform: 'none',
  },
  h2: {
    color: '#293127',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    marginTop: 4,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#E28A58',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },
  serviceTitle: {
    color: '#293127',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    letterSpacing: 0,
  },
  serviceText: {
    color: '#7B8178',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
    marginTop: 6,
  },
  cardTitle: {
    color: '#293127',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#E28A58',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },
  muted: {
    color: '#85897F',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.medium,
  },
  mutedSmall: {
    color: '#85897F',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.medium,
  },
  about: {
    color: '#687064',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    fontFamily: fonts.regular,
  },
  tagText: {
    color: '#B36E45',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.bold,
  },
  slotDay: {
    color: '#85897F',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  slotTime: {
    color: '#242B24',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    marginTop: 3,
  },
  price: {
    color: '#242B24',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 18,
  },
  primaryButtonText: {
    color: '#FFFDF8',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  calendarDay: {
    color: 'rgba(255,253,248,0.84)',
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  calendarTime: {
    color: '#FFFDF8',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 22,
    marginTop: 8,
  },
  calendarType: {
    color: 'rgba(255,253,248,0.86)',
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontSize: 12,
    marginTop: 8,
  },
  panelLabel: {
    color: '#6C7168',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 13,
    marginBottom: 10,
  },
  optionTitle: {
    color: '#242B24',
    fontWeight: '800',
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  optionCopy: {
    color: '#70776E',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
    fontFamily: fonts.regular,
  },
  input: {
    minHeight: 52,
    borderRadius: 24,
    backgroundColor: '#F4EBDD',
    paddingHorizontal: 16,
    color: '#293127',
    fontSize: 16,
    marginBottom: 16,
    fontFamily: fonts.medium,
  },
  inlineText: {
    backgroundColor: '#EAF1DB',
    color: '#789264',
    fontWeight: '800',
    fontFamily: fonts.bold,
    fontSize: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 17,
  },
  messageAuthor: {
    color: '#6F8F72',
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontSize: 12,
    marginBottom: 5,
  },
  messageText: {
    color: '#242B24',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  chatInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E1D4',
    color: '#242B24',
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  tabText: {
    color: '#A3A59F',
    fontWeight: '700',
    fontFamily: fonts.bold,
    fontSize: 11,
    marginTop: 3,
  },
  tabTextActive: {
    color: '#2F3A2E',
    fontFamily: fonts.bold,
  },
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#707070',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 35,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: '#161616',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '400',
    fontFamily: fonts.regular,
    marginTop: 3,
  },
  dbBadge: {
    minHeight: 48,
    maxWidth: 150,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  dbBadgeText: {
    color: '#161616',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  roleBar: {
    maxHeight: 52,
  },
  roleBarContent: {
    paddingHorizontal: 24,
    gap: 10,
  },
  pill: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 0,
  },
  pillActive: {
    backgroundColor: '#9BDDFA',
    borderColor: '#9BDDFA',
  },
  pillDark: {
    backgroundColor: '#F5F5F5',
    borderColor: '#F5F5F5',
  },
  pillText: {
    color: '#606060',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  pillTextActive: {
    color: '#161616',
  },
  pillTextDark: {
    color: '#606060',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
    marginTop: 8,
  },
  eyebrow: {
    color: '#6A6A6A',
    fontSize: 13,
    fontWeight: '400',
    fontFamily: fonts.regular,
    textTransform: 'none',
  },
  h2: {
    color: '#161616',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    fontFamily: fonts.semibold,
    marginTop: 4,
    letterSpacing: 0,
  },
  sectionAction: {
    color: '#606060',
    fontWeight: '400',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  serviceRow: {
    gap: 14,
    paddingBottom: 32,
  },
  serviceTile: {
    width: 138,
    minHeight: 76,
    backgroundColor: '#F5F5F5',
    borderRadius: 34,
    padding: 10,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceTileActive: {
    backgroundColor: '#9BDDFA',
    borderColor: '#9BDDFA',
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  serviceTitle: {
    color: '#161616',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0,
    width: 58,
  },
  serviceText: {
    display: 'none',
  },
  walkerCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 30,
    padding: 18,
    marginBottom: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  walkerTop: {
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    color: '#161616',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semibold,
    letterSpacing: 0,
    flexShrink: 1,
  },
  rating: {
    color: '#161616',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  muted: {
    color: '#6A6A6A',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
  },
  mutedSmall: {
    color: '#6A6A6A',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.regular,
  },
  about: {
    color: '#404040',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    fontFamily: fonts.regular,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tag: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    color: '#404040',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  slotChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 0,
  },
  slotDay: {
    color: '#6A6A6A',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: fonts.regular,
  },
  slotTime: {
    color: '#161616',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semibold,
    marginTop: 4,
  },
  cardFooter: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    color: '#161616',
    fontWeight: '600',
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  primaryButtonSmall: {
    backgroundColor: '#1D1D1F',
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#1D1D1F',
    height: 58,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  calendarPanel: {
    backgroundColor: '#F6F6F6',
    borderRadius: 32,
    padding: 20,
    borderWidth: 0,
    marginBottom: 24,
    shadowOpacity: 0,
    elevation: 0,
  },
  calendarSlot: {
    width: 112,
    backgroundColor: '#1D1D1F',
    borderRadius: 30,
    padding: 16,
  },
  calendarDay: {
    color: 'rgba(255,255,255,0.76)',
    fontWeight: '400',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  calendarTime: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: fonts.semibold,
    fontSize: 22,
    marginTop: 8,
  },
  calendarType: {
    color: '#9BDDFA',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 8,
  },
  calendarSlotBusy: {
    backgroundColor: '#ECECEC',
    borderWidth: 0,
  },
  calendarBusyText: {
    color: '#8A8A8A',
  },
  calendarBusyAccent: {
    color: '#8A8A8A',
  },
  optionCard: {
    width: '48%',
    minHeight: 104,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 16,
    borderWidth: 0,
  },
  optionCardActive: {
    backgroundColor: '#9BDDFA',
    borderColor: '#9BDDFA',
  },
  optionTitle: {
    color: '#161616',
    fontWeight: '600',
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  optionTitleActive: {
    color: '#161616',
  },
  optionCopy: {
    color: '#6A6A6A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
    fontFamily: fonts.regular,
  },
  composeCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 32,
    padding: 20,
    borderWidth: 0,
    marginBottom: 20,
    shadowOpacity: 0,
    elevation: 0,
  },
  input: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    color: '#161616',
    fontSize: 16,
    marginBottom: 16,
    fontFamily: fonts.regular,
  },
  requestCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 32,
    padding: 14,
    marginBottom: 18,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 15,
    shadowOpacity: 0,
    elevation: 0,
  },
  dogPhoto: {
    width: 98,
    minHeight: 130,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  budget: {
    color: '#161616',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.semibold,
  },
  inlineText: {
    backgroundColor: '#FFFFFF',
    color: '#404040',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  chatInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#F6F6F6',
    borderRadius: 26,
    paddingHorizontal: 18,
    borderWidth: 0,
    color: '#161616',
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1D1D1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '84%',
    backgroundColor: '#F6F6F6',
    borderRadius: 26,
    padding: 15,
    borderWidth: 0,
    alignSelf: 'flex-start',
  },
  messageMine: {
    backgroundColor: '#9BDDFA',
    borderColor: '#9BDDFA',
    alignSelf: 'flex-end',
  },
  profilePanel: {
    backgroundColor: '#F6F6F6',
    borderRadius: 32,
    padding: 20,
    borderWidth: 0,
    marginBottom: 22,
    shadowOpacity: 0,
    elevation: 0,
  },
  reviewCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 28,
    padding: 16,
    borderWidth: 0,
    marginBottom: 12,
  },
  userRow: {
    backgroundColor: '#F6F6F6',
    borderRadius: 28,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 14,
  },
  tabBar: {
    marginHorizontal: 44,
    marginBottom: Platform.OS === 'ios' ? 10 : 16,
    minHeight: 72,
    backgroundColor: '#1D1D1F',
    borderRadius: 36,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
  },
  tabItemActive: {
    backgroundColor: '#9BDDFA',
  },
  tabText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: fonts.medium,
    fontSize: 0,
    marginTop: 0,
  },
  tabTextActive: {
    color: '#161616',
    fontFamily: fonts.medium,
  },
  shell: {
    flex: 1,
    width: '100%',
  },
  shellDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1180,
    paddingHorizontal: 28,
  },
  appDesktop: {
    width: '100%',
    alignSelf: 'center',
  },
  headerDesktop: {
    paddingHorizontal: 10,
    paddingTop: 28,
    paddingBottom: 22,
  },
  roleBarContentDesktop: {
    paddingHorizontal: 10,
  },
  contentDesktop: {
    paddingHorizontal: 10,
  },
  walkerList: {
    width: '100%',
  },
  requestList: {
    width: '100%',
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    alignItems: 'stretch',
  },
  desktopGridItem: {
    flexBasis: '48.5%',
    flexGrow: 1,
    minWidth: 360,
    marginBottom: 0,
  },
  serviceRowDesktop: {
    width: '100%',
    gap: 16,
  },
  serviceTile: {
    width: 164,
    minHeight: 76,
    backgroundColor: '#F5F5F5',
    borderRadius: 34,
    padding: 10,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceTitle: {
    color: '#161616',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fonts.medium,
    letterSpacing: 0,
    width: 84,
  },
  calendarSlotSelected: {
    backgroundColor: '#9BDDFA',
  },
  primaryButtonDisabled: {
    backgroundColor: '#CFCFCF',
  },
  tabBarDesktop: {
    alignSelf: 'center',
    width: 430,
    marginHorizontal: 0,
    marginBottom: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 76 : 54,
    paddingHorizontal: 18,
  },
  cityPicker: {
    width: 286,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cityPickerDesktop: {
    marginRight: 40,
    marginTop: 8,
  },
  cityPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cityPickerTitle: {
    color: '#161616',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: fonts.semibold,
  },
  cityPickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityOption: {
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cityOptionActive: {
    backgroundColor: '#9BDDFA',
  },
  cityOptionText: {
    color: '#4A4A4A',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: fonts.medium,
  },
  cityOptionTextActive: {
    color: '#161616',
  },
  halfInput: {
    width: '48%',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
  },
  secondaryButton: {
    height: 54,
    minWidth: 76,
    borderRadius: 27,
    backgroundColor: '#9BDDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: '#161616',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.semibold,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 14,
    marginBottom: 16,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#9BDDFA',
  },
  bottomSpacer: {
    height: 42,
  },
});
