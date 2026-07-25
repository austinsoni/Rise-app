let currentUser = null;
let currentProfile = null;
let isLoginMode = true;

const obSelections = {
  sex: null,
  activity: null,
  goal: null,
  location: null
};

const $ = (id) => document.getElementById(id);

function showError(id, message, success = false) {
  const element = $(id);
  element.textContent = message;
  element.style.color = success ? "#2f7a50" : "var(--danger)";
  element.style.display = "block";
}

function clearError(id) {
  $(id).style.display = "none";
}

// ============================================
// AUTHENTICATION
// ============================================

$("toggleAuthLink").addEventListener("click", toggleAuth);

function toggleAuth() {
  isLoginMode = !isLoginMode;

  $("authTitle").textContent = isLoginMode
    ? "Welcome back"
    : "Create your account";

  $("authSub").textContent = isLoginMode
    ? "Log in to continue building your future."
    : "Start learning skills for real life.";

  $("authSubmitBtn").textContent = isLoginMode
    ? "Log in"
    : "Sign up";

  $("toggleAuthText").innerHTML = isLoginMode
    ? 'New here? <a id="toggleAuthLink">Create an account</a>'
    : 'Already have an account? <a id="toggleAuthLink">Log in</a>';

  $("toggleAuthLink").addEventListener("click", toggleAuth);
}

$("authSubmitBtn").addEventListener("click", async () => {
  clearError("authError");

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  if (!email || !password) {
    showError("authError", "Please enter your email and password.");
    return;
  }

  const result = isLoginMode
    ? await supabaseClient.auth.signInWithPassword({
        email,
        password
      })
    : await supabaseClient.auth.signUp({
        email,
        password
      });

  if (result.error) {
    showError("authError", result.error.message);
    return;
  }

  if (
    !isLoginMode &&
    result.data.user &&
    !result.data.session
  ) {
    showError(
      "authError",
      "Check your email to confirm your account, then log in.",
      true
    );
    return;
  }

  currentUser = result.data.user;
  await afterLogin();
});

$("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

// ============================================
// ONBOARDING
// ============================================

function setupPills(groupId, key) {
  $(groupId)
    .querySelectorAll(".pill")
    .forEach((pill) => {
      pill.addEventListener("click", () => {
        $(groupId)
          .querySelectorAll(".pill")
          .forEach((item) =>
            item.classList.remove("active")
          );

        pill.classList.add("active");
        obSelections[key] = pill.dataset.val;
      });
    });
}

setupPills("ob_sex", "sex");
setupPills("ob_activity", "activity");
setupPills("ob_goal", "goal");
setupPills("ob_location", "location");

$("ob_age").addEventListener("input", (event) => {
  const age = Number(event.target.value);

  $("youthNote").style.display =
    age && age < 18 ? "block" : "none";
});

$("saveProfileBtn").addEventListener("click", async () => {
  clearError("onboardError");

  const displayName = $("ob_name").value.trim();
  const age = Number($("ob_age").value);
  const height = Number($("ob_height").value);
  const weight = Number($("ob_weight").value);

  if (
    !displayName ||
    age < 13 ||
    !height ||
    !weight ||
    Object.values(obSelections).some(
      (value) => !value
    )
  ) {
    showError(
      "onboardError",
      "Please complete every field. Rise is designed for users aged 13 and over."
    );
    return;
  }

  const profileData = {
    id: currentUser.id,
    email: currentUser.email,
    display_name: displayName,
    age,
    height_cm: height,
    weight_kg: weight,
    sex: obSelections.sex,
    activity_level: obSelections.activity,
    goal: obSelections.goal,
    training_location: obSelections.location,
    is_adult: age >= 18,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert(profileData)
    .select()
    .single();

  if (error) {
    showError("onboardError", error.message);
    return;
  }

  currentProfile = data;
  showApp();
});

// ============================================
// LOGIN CHECK
// ============================================

async function afterLogin() {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  currentUser = user;

  $("signOutBtn").classList.remove("hidden");

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  $("authScreen").classList.add("hidden");

  if (error) {
    console.error(error);
  }

  if (data) {
    currentProfile = data;
    showApp();
  } else {
    $("onboardScreen").classList.remove("hidden");
  }
}

// ============================================
// APP NAVIGATION
// ============================================

function showApp() {
  $("authScreen").classList.add("hidden");
  $("onboardScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  renderHome();
  renderProfile();
}

document
  .querySelectorAll("[data-view]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      openView(button.dataset.view);
    });
  });

document
  .querySelectorAll("[data-open-view]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      openView(button.dataset.openView);
    });
  });

function openView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((view) =>
      view.classList.add("hidden")
    );

  $(viewId).classList.remove("hidden");

  document
    .querySelectorAll(".nav-btn")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === viewId
      );
    });
}

function getDisplayName() {
  return (
    currentProfile?.display_name ||
    currentUser?.email?.split("@")[0] ||
    "there"
  );
}

// ============================================
// FITNESS
// ============================================

function getWorkoutPlan(profile) {
  const plans = {
    build_muscle: {
      home: [
        "Push-ups: 3 sets at a comfortable level",
        "Bodyweight squats: 3 sets of 10–15",
        "Backpack rows: 3 sets of 10",
        "Finish with 5 minutes of mobility"
      ],
      gym: [
        "Goblet squat: 3 sets of 8–12",
        "Machine or dumbbell press: 3 sets of 8–12",
        "Cable or machine row: 3 sets of 8–12",
        "Finish with gentle mobility"
      ]
    },

    sport_performance: {
      home: [
        "Dynamic warm-up: 5 minutes",
        "Short acceleration runs with full rest",
        "Lateral movement practice",
        "Core stability and mobility"
      ],
      gym: [
        "Dynamic warm-up",
        "Controlled lower-body strength work",
        "Upper-body pull and push exercises",
        "Mobility and recovery"
      ]
    },

    move_more: {
      home: [
        "Take a 10–20 minute walk",
        "Complete 5 minutes of gentle stretching",
        "Break up long periods of sitting"
      ],
      gym: [
        "Easy cardio at a conversational pace",
        "Try two beginner resistance machines",
        "Cool down gently"
      ]
    },

    general_fitness: {
      home: [
        "Brisk walk or easy movement: 15 minutes",
        "Squats: 3 sets of 10",
        "Incline or knee push-ups: 3 sets of 8",
        "Stretch gently"
      ],
      gym: [
        "Easy cardio: 10 minutes",
        "Beginner full-body machine circuit",
        "Cool down and stretch"
      ]
    },

    lose_fat: {
      home: [
        "Brisk walk: 20 minutes",
        "Beginner full-body circuit",
        "Drink water and eat balanced meals",
        "Prioritise sleep and consistency"
      ],
      gym: [
        "Moderate cardio at a conversational pace",
        "Beginner full-body resistance circuit",
        "Cool down",
        "Focus on sustainable habits"
      ]
    }
  };

  const selectedPlan =
    plans[profile.goal] ||
    plans.general_fitness;

  const selectedLocation =
    profile.training_location === "both"
      ? "home"
      : profile.training_location;

  return (
    selectedPlan[selectedLocation] ||
    selectedPlan.home
  );
}

// ============================================
// NUTRITION
// ============================================

function getNutritionHabits(profile) {
  const habits = [
    "Include a protein food in a meal",
    "Add fruit or vegetables where practical",
    "Drink water regularly",
    "Eat slowly enough to notice fullness"
  ];

  if (!profile.is_adult) {
    habits.push(
      "Choose enough food to support growth, school and activity"
    );
  } else {
    habits.push(
      "Use sustainable portions rather than extreme restriction"
    );
  }

  return habits;
}

// ============================================
// HOME SCREEN
// ============================================

function renderHome() {
  $("homeName").textContent = getDisplayName();

  $("dashDate").textContent =
    new Date().toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

  $("workoutTasks").innerHTML = "";

  getWorkoutPlan(currentProfile).forEach(
    (task, index) => {
      $("workoutTasks").append(
        makeTask(task, "workout", index)
      );
    }
  );

  $("nutritionTasks").innerHTML = "";

  getNutritionHabits(currentProfile).forEach(
    (task, index) => {
      $("nutritionTasks").append(
        makeTask(task, "nutrition", index)
      );
    }
  );

  loadStreak();
}

function makeTask(text, type, index) {
  const row = document.createElement("div");

  row.className = "task";

  row.innerHTML = `
    <button class="check">✓</button>
    <span>${escapeHtml(text)}</span>
  `;

  row
    .querySelector("button")
    .addEventListener("click", async (event) => {
      if (
        event.target.classList.contains("done")
      ) {
        return;
      }

      event.target.classList.add("done");
      await logCompletion(type);
    });

  return row;
}

async function logCompletion(type) {
  const table =
    type === "workout"
      ? "workout_logs"
      : "meal_logs";

  const information =
    type === "workout"
      ? {
          user_id: currentUser.id,
          workout_name: "Daily Rise task"
        }
      : {
          user_id: currentUser.id,
          meal_description: "Daily Rise habit",
          was_balanced: true
        };

  await supabaseClient
    .from(table)
    .insert(information);

  loadStreak();
}

async function loadStreak() {
  const { data } = await supabaseClient
    .from("workout_logs")
    .select("completed_at")
    .eq("user_id", currentUser.id)
    .order("completed_at", {
      ascending: false
    });

  if (!data || data.length === 0) {
    $("streakCount").textContent = "0";
    return;
  }

  const completedDays = new Set(
    data.map((item) =>
      new Date(
        item.completed_at
      ).toDateString()
    )
  );

  let streak = 0;
  const currentDate = new Date();

  while (
    completedDays.has(
      currentDate.toDateString()
    )
  ) {
    streak++;
    currentDate.setDate(
      currentDate.getDate() - 1
    );
  }

  $("streakCount").textContent =
    String(streak);
}

// ============================================
// AI COACH
// ============================================

document
  .querySelectorAll(".quick")
  .forEach((button) => {
    button.addEventListener("click", () => {
      $("coachInput").value =
        button.textContent;

      $("coachInput").focus();
    });
  });

$("sendCoachBtn").addEventListener(
  "click",
  sendCoachMessage
);

$("coachInput").addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendCoachMessage();
    }
  }
);

async function sendCoachMessage() {
  const message =
    $("coachInput").value.trim();

  if (!message) {
    return;
  }

  addMessage(message, "user");

  $("coachInput").value = "";
  $("typing").classList.remove("hidden");
  $("sendCoachBtn").disabled = true;

  try {
    const {
      data: { session }
    } =
      await supabaseClient.auth.getSession();

    const response = await fetch(
      "/api/coach",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${
              session?.access_token || ""
            }`
        },
        body: JSON.stringify({
          message,
          profile: {
            age: currentProfile.age,
            is_adult:
              currentProfile.is_adult,
            goal: currentProfile.goal,
            interests:
              currentProfile.interests,
            display_name:
              getDisplayName()
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "The coach could not respond."
      );
    }

    addMessage(result.reply, "ai");
  } catch (error) {
    addMessage(
      `I couldn't connect to the AI coach yet. ${error.message}`,
      "ai"
    );
  } finally {
    $("typing").classList.add("hidden");
    $("sendCoachBtn").disabled = false;
  }
}

function addMessage(text, sender) {
  const message = document.createElement(
    "div"
  );

  message.className = `msg ${sender}`;
  message.textContent = text;

  $("messages").append(message);

  $("messages").scrollTop =
    $("messages").scrollHeight;
}

// ============================================
// PROFILE
// ============================================

function renderProfile() {
  $("profileDisplayName").textContent =
    getDisplayName();

  $("profileUsername").textContent =
    currentProfile.username
      ? `@${currentProfile.username}`
      : "Add a username";

  $("editDisplayName").value =
    currentProfile.display_name || "";

  $("editUsername").value =
    currentProfile.username || "";

  $("editBio").value =
    currentProfile.bio || "";

  $("editInterests").value =
    currentProfile.interests || "";

  $("profileGoal").textContent =
    (
      currentProfile.goal || "—"
    ).replaceAll("_", " ");

  $("profileTraining").textContent =
    currentProfile.training_location ||
    "—";

  $("profileAgeGroup").textContent =
    currentProfile.is_adult
      ? "18+"
      : "13–17";

  if (currentProfile.avatar_url) {
    $("avatarImage").src =
      currentProfile.avatar_url;

    $("avatarImage").classList.remove(
      "hidden"
    );

    $("avatarPlaceholder").classList.add(
      "hidden"
    );
  }
}

$("savePublicProfileBtn").addEventListener(
  "click",
  async () => {
    const username = $("editUsername")
      .value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

    const updates = {
      display_name:
        $("editDisplayName").value.trim(),
      username: username || null,
      bio: $("editBio").value.trim(),
      interests:
        $("editInterests").value.trim(),
      updated_at:
        new Date().toISOString()
    };

    if (!updates.display_name) {
      $("profileStatus").textContent =
        "Please enter a display name.";
      return;
    }

    const { data, error } =
      await supabaseClient
        .from("profiles")
        .update(updates)
        .eq("id", currentUser.id)
        .select()
        .single();

    if (error) {
      $("profileStatus").textContent =
        error.message;
      return;
    }

    currentProfile = data;

    $("profileStatus").textContent =
      "Profile saved.";

    renderProfile();
    renderHome();
  }
);

$("uploadAvatarBtn").addEventListener(
  "click",
  async () => {
    const file =
      $("avatarFile").files[0];

    if (!file) {
      $("profileStatus").textContent =
        "Choose a picture first.";
      return;
    }

    if (
      file.size >
      3 * 1024 * 1024
    ) {
      $("profileStatus").textContent =
        "Please choose an image smaller than 3 MB.";
      return;
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!validTypes.includes(file.type)) {
      $("profileStatus").textContent =
        "Use a JPG, PNG or WebP image.";
      return;
    }

    $("profileStatus").textContent =
      "Uploading…";

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    const filePath =
      `${currentUser.id}/avatar.${extension}`;

    const { error } =
      await supabaseClient.storage
        .from("Avatar")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        });

    if (error) {
      $("profileStatus").textContent =
        error.message;
      return;
    }

    const { data } =
      supabaseClient.storage
        .from("Avatar")
        .getPublicUrl(filePath);

    const imageUrl =
      `${data.publicUrl}?v=${Date.now()}`;

    const savedProfile =
      await supabaseClient
        .from("profiles")
        .update({
          avatar_url: imageUrl,
          updated_at:
            new Date().toISOString()
        })
        .eq("id", currentUser.id)
        .select()
        .single();

    if (savedProfile.error) {
      $("profileStatus").textContent =
        savedProfile.error.message;
      return;
    }

    currentProfile =
      savedProfile.data;

    $("profileStatus").textContent =
      "Profile picture updated.";

    renderProfile();
  }
);

// ============================================
// SECURITY
// ============================================

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
  );
}

// ============================================
// START APP
// ============================================

(async function init() {
  const {
    data: { session }
  } =
    await supabaseClient.auth.getSession();

  if (session) {
    currentUser = session.user;
    await afterLogin();
  }
})();
