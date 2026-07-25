// ============================================
// STATE
// ============================================
let currentUser = null;
let currentProfile = null;
let isLoginMode = true;
const obSelections = { sex:null, activity:null, goal:null, location:null };

// ============================================
// ELEMENTS
// ============================================
const authScreen = document.getElementById('authScreen');
const onboardScreen = document.getElementById('onboardScreen');
const dashScreen = document.getElementById('dashScreen');
const signOutBtn = document.getElementById('signOutBtn');

// ============================================
// AUTH SCREEN LOGIC
// ============================================
document.getElementById('toggleAuthLink').addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  document.getElementById('authTitle').textContent = isLoginMode ? 'Welcome back' : 'Create your account';
  document.getElementById('authSub').textContent = isLoginMode ? 'Log in to pick up where you left off.' : 'Takes less than a minute.';
  document.getElementById('authSubmitBtn').textContent = isLoginMode ? 'Log in' : 'Sign up';
  document.getElementById('toggleAuthText').innerHTML = isLoginMode
    ? 'New here? <a id="toggleAuthLink2">Create an account</a>'
    : 'Already have an account? <a id="toggleAuthLink2">Log in</a>';
  document.getElementById('toggleAuthLink2').addEventListener('click', () => document.getElementById('toggleAuthLink').click());
});

document.getElementById('authSubmitBtn').addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Please fill in both fields.';
    errEl.style.display = 'block';
    return;
  }

  let result;
  if (isLoginMode) {
    result = await supabaseClient.auth.signInWithPassword({ email, password });
  } else {
    result = await supabaseClient.auth.signUp({ email, password });
  }

  if (result.error) {
    errEl.textContent = result.error.message;
    errEl.style.display = 'block';
    return;
  }

  if (!isLoginMode && result.data.user && !result.data.session) {
    errEl.style.color = 'var(--lime)';
    errEl.textContent = 'Check your email to confirm your account, then log in.';
    errEl.style.display = 'block';
    return;
  }

  currentUser = result.data.user;
  await afterLogin();
});

signOutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

// ============================================
// ONBOARDING SCREEN LOGIC
// ============================================
function setupPillGroup(groupId, key) {
  const group = document.getElementById(groupId);
  group.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      obSelections[key] = pill.dataset.val;
    });
  });
}
setupPillGroup('ob_sex', 'sex');
setupPillGroup('ob_activity', 'activity');
setupPillGroup('ob_goal', 'goal');
setupPillGroup('ob_location', 'location');

document.getElementById('ob_age').addEventListener('input', (e) => {
  const age = parseInt(e.target.value);
  document.getElementById('youthNote').style.display = (age && age < 18) ? 'block' : 'none';
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('onboardError');
  const age = parseInt(document.getElementById('ob_age').value);
  const height = parseFloat(document.getElementById('ob_height').value);
  const weight = parseFloat(document.getElementById('ob_weight').value);

  if (!age || !height || !weight || !obSelections.sex || !obSelections.activity || !obSelections.goal || !obSelections.location) {
    errEl.textContent = 'Please fill in every field so we can personalize your plan.';
    errEl.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.from('profiles').upsert({
    id: currentUser.id,
    email: currentUser.email,
    age, height_cm: height, weight_kg: weight,
    sex: obSelections.sex,
    activity_level: obSelections.activity,
    goal: obSelections.goal,
    training_location: obSelections.location
  }).select().single();

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    return;
  }

  currentProfile = data;
  showDashboard();
});

// ============================================
// AFTER LOGIN — decide which screen to show
// ============================================
async function afterLogin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user;
  signOutBtn.classList.remove('hidden');

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (profile) {
    currentProfile = profile;
    showDashboard();
  } else {
    authScreen.classList.add('hidden');
    onboardScreen.classList.remove('hidden');
  }
}

// ============================================
// PERSONALIZATION ENGINE
// ============================================
function calcTDEE(profile) {
  // Mifflin-St Jeor BMR formula
  const { age, height_cm, weight_kg, sex, activity_level } = profile;
  let bmr;
  if (sex === 'male') {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  } else {
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }
  const multipliers = { low: 1.3, moderate: 1.55, high: 1.8 };
  return Math.round(bmr * (multipliers[activity_level] || 1.4));
}

function getWorkoutPlan(profile) {
  const { goal, training_location } = profile;
  const plans = {
    build_muscle: {
      home: ['Push-ups 4x10', 'Bodyweight squats 4x15', 'Pike push-ups 3x8', 'Plank 3x40s'],
      gym: ['Bench press 4x8', 'Squats 4x8', 'Rows 4x10', 'Overhead press 3x10'],
    },
    lose_fat: {
      home: ['20 min brisk walk/jog', 'Bodyweight circuit x3 rounds', 'Mountain climbers 3x30s', 'Plank 3x40s'],
      gym: ['20 min incline treadmill', 'Full-body circuit 3 rounds', 'Rowing machine 10 min'],
    },
    general_fitness: {
      home: ['Jumping jacks 3x30s', 'Push-ups 3x10', 'Squats 3x15', 'Stretch 5 min'],
      gym: ['Light cardio 15 min', 'Full-body machine circuit', 'Stretch 5 min'],
    },
    sport_performance: {
      home: ['Sprint intervals 6x20s', 'Lateral bounds 3x10', 'Core circuit', 'Mobility drills'],
      gym: ['Sprint intervals', 'Box jumps 3x8', 'Core circuit', 'Mobility drills'],
    },
    move_more: {
      home: ['10 min walk', 'Light stretching', 'Bodyweight squats 2x10'],
      gym: ['15 min easy cardio', 'Light stretching'],
    }
  };
  const goalPlan = plans[goal] || plans.general_fitness;
  const loc = training_location === 'both' ? 'gym' : training_location;
  return goalPlan[loc] || goalPlan.home;
}

function getNutritionTasks(profile) {
  return [
    'Eat a protein source with every meal',
    'Have at least 2 servings of vegetables/fruit today',
    'Drink water regularly through the day',
    profile.is_adult ? 'Log your meals to track your deficit/surplus' : 'Notice how your energy feels after meals'
  ];
}

const HYGIENE_TIPS = [
  'Shampoo 2-3x a week if your hair tends dry, daily if it gets oily fast — over-washing can actually dry out your scalp.',
  'Brush for a full 2 minutes, morning and night — most people stop at 45 seconds without realizing it.',
  'Apply deodorant to clean, dry skin — putting it on damp skin makes it less effective.',
  'Change pillowcases weekly — they build up oil and bacteria that can contribute to breakouts.',
  'Rinse after sweating when you can — bacteria causing body odor multiply fast on damp skin.',
  'Floss before bed, not just before a dentist visit — it prevents the buildup that causes most gum issues.'
];

const GUIDES = [
  { title:'How often should I actually work out?', body:'2-3 sessions a week is a great starting point if you\'re new — it builds fitness while giving your body time to recover. You can build up to 4-5 as you get stronger. More isn\'t always better; consistency beats intensity early on.' },
  { title:'Cardio vs weights — do I need both?', body:'Yes, ideally. Weights build strength and shape your body over time; cardio supports heart health and endurance. For fat loss specifically, diet matters more than exercise type — you can\'t out-train a bad diet, but combining both works best.' },
  { title:'Sore vs injured — what\'s the difference?', body:'Normal soreness (DOMS) shows up 24-48 hours after a new or harder workout, feels dull, and improves with light movement. Injury pain is usually sharp, sudden, one-sided, or affects a joint — and gets worse with movement. When in doubt, rest and check with a doctor.' },
  { title:'How much water should I drink daily?', body:'A common guide is roughly 30-35ml per kg of body weight, more if you\'re active or it\'s hot. Simplest check: if your urine is pale yellow, you\'re doing fine.' },
  { title:'How often should I shampoo and condition?', body:'Oily hair: every day or every other day. Normal hair: every 2-3 days. Dry, curly, or coily hair: 1-2 times a week, since it needs natural oils to stay healthy. Condition every wash to prevent breakage, focusing on the ends, not the scalp.' },
  { title:'Is it normal to not see results right away?', body:'Yes — most people see fitness improvements (energy, strength) in 2-3 weeks, but visible physical change usually takes 6-8 weeks of consistency. Progress photos or how your clothes fit are more reliable than the scale day to day.' },
];

// ============================================
// RENDER DASHBOARD
// ============================================
async function showDashboard() {
  authScreen.classList.add('hidden');
  onboardScreen.classList.add('hidden');
  dashScreen.classList.remove('hidden');

  const p = currentProfile;
  document.getElementById('dashDate').textContent = new Date().toLocaleDateString('en-AU', { weekday:'long', month:'long', day:'numeric' });

  // Stats
  const tdee = calcTDEE(p);
  document.getElementById('statTDEE').textContent = tdee + ' kcal/day';
  document.getElementById('statGoal').textContent = p.goal.replaceAll('_',' ');
  document.getElementById('statLocation').textContent = p.training_location;

  // Workout
  const workout = getWorkoutPlan(p);
  document.getElementById('workoutDesc').textContent = `Based on your ${p.goal.replaceAll('_',' ')} goal, ${p.training_location} training`;
  const wEl = document.getElementById('workoutTasks');
  wEl.innerHTML = '';
  workout.forEach((item, i) => wEl.appendChild(makeTaskItem(item, `w_${i}`)));

  // Nutrition
  const nutrition = getNutritionTasks(p);
  document.getElementById('nutritionDesc').textContent = p.is_adult ? 'Personalized to your calorie target' : 'Building good habits, no numbers needed';
  const nEl = document.getElementById('nutritionTasks');
  nEl.innerHTML = '';
  nutrition.forEach((item, i) => nEl.appendChild(makeTaskItem(item, `n_${i}`)));

  // Hygiene tip (rotates by day)
  const dayIndex = new Date().getDate() % HYGIENE_TIPS.length;
  document.getElementById('hygieneTip').textContent = HYGIENE_TIPS[dayIndex];

  // Guides
  const gEl = document.getElementById('guideList');
  gEl.innerHTML = '';
  GUIDES.forEach(g => {
    const item = document.createElement('div');
    item.className = 'guide-item';
    item.innerHTML = `<h4>${g.title}</h4><p>${g.body}</p>`;
    item.addEventListener('click', () => item.classList.toggle('open'));
    gEl.appendChild(item);
  });

  // Streak
  await loadStreak();
}

function makeTaskItem(text, id) {
  const row = document.createElement('div');
  row.className = 'task-item';
  row.innerHTML = `<button class="check-btn" id="check_${id}">✓</button><div class="task-text">${text}</div>`;
  row.querySelector('button').addEventListener('click', async (e) => {
    e.target.classList.toggle('done');
    if (e.target.classList.contains('done')) {
      await logCompletion(id.startsWith('w_') ? 'workout' : 'nutrition');
    }
  });
  return row;
}

async function logCompletion(type) {
  if (type === 'workout') {
    await supabaseClient.from('workout_logs').insert({ user_id: currentUser.id, workout_name: 'Daily task' });
  } else {
    await supabaseClient.from('meal_logs').insert({ user_id: currentUser.id, meal_description: 'Daily task', was_balanced: true });
  }
  loadStreak();
}

async function loadStreak() {
  const { data } = await supabaseClient
    .from('workout_logs')
    .select('completed_at')
    .eq('user_id', currentUser.id)
    .order('completed_at', { ascending: false });

  if (!data || data.length === 0) {
    document.getElementById('streakCount').textContent = '0';
    return;
  }

  // Count consecutive days with at least one log
  const days = new Set(data.map(d => new Date(d.completed_at).toDateString()));
  let streak = 0;
  let cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  document.getElementById('streakCount').textContent = streak;
}

// ============================================
// INIT — check if already logged in
// ============================================
(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await afterLogin();
  }
})();
