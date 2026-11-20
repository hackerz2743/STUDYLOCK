const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://goaedlcpzkmwwkuhvttu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4TbWd2O1-pn3yhubVrVQCw_iiMbKQ6H';

let supabase = null;
let currentSession = null;
let currentUser = null;
let currentProfile = null;
let realtimeChannel = null;
let heartbeatTimer = null;
let mainWindowRef = null;

function getAuthFilePath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'squad_session.json');
}

function saveLocalSession(sessionData) {
  try {
    const filePath = getAuthFilePath();
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save squad session:', err);
  }
}

function loadLocalSession() {
  try {
    const filePath = getAuthFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load squad session:', err);
  }
  return null;
}

function clearLocalSession() {
  try {
    const filePath = getAuthFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to clear squad session:', err);
  }
}

async function initSquadService(mainWindow) {
  mainWindowRef = mainWindow;

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: true
    }
  });

  // Try auto-resuming existing session
  const stored = loadLocalSession();
  if (stored && stored.refresh_token) {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token
      });

      if (!error && data && data.user) {
        currentSession = data.session;
        currentUser = data.user;
        saveLocalSession(data.session);
        await fetchAndSyncProfile();
        setupRealtimePresence();
        startHeartbeatLoop();
        console.log('✓ Squad session resumed for:', currentUser.email);
      } else {
        clearLocalSession();
      }
    } catch (e) {
      console.warn('Failed to restore squad session:', e.message);
      clearLocalSession();
    }
  }

  return { isAuthed: !!currentUser, profile: currentProfile };
}

function setupRealtimePresence() {
  if (!supabase || realtimeChannel) return;

  try {
    realtimeChannel = supabase
      .channel('squad-presence-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('squad-profile-updated', payload.new);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('squad-friends-updated');
        }
      })
      .subscribe((status) => {
        console.log('Squad Realtime Channel status:', status);
      });
  } catch (e) {
    console.error('Error setting up squad realtime presence:', e);
  }
}

function teardownRealtimePresence() {
  if (supabase && realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeatLoop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // Send active heartbeat every 45 seconds while app is running
  heartbeatTimer = setInterval(async () => {
    if (currentUser && supabase) {
      try {
        await supabase.from('profiles').update({
          last_heartbeat: new Date().toISOString()
        }).eq('id', currentUser.id);
      } catch (e) {}
    }
  }, 45000);
}

async function fetchAndSyncProfile() {
  if (!currentUser || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!error && data) {
      currentProfile = data;
      return data;
    }

    // If profile row doesn't exist yet, create it
    const defaultUsername = (currentUser.user_metadata && currentUser.user_metadata.user_name) ||
      currentUser.email.split('@')[0];
    const defaultAvatar = (currentUser.user_metadata && currentUser.user_metadata.avatar_url) || '⚡';

    const newProfile = {
      id: currentUser.id,
      username: defaultUsername,
      display_name: defaultUsername,
      avatar_url: defaultAvatar,
      is_studying: false,
      today_study_seconds: 0,
      last_heartbeat: new Date().toISOString()
    };

    const { data: created, error: createErr } = await supabase
      .from('profiles')
      .upsert(newProfile)
      .select()
      .maybeSingle();

    if (!createErr && created) {
      currentProfile = created;
      return created;
    }
  } catch (err) {
    console.error('Error fetching profile:', err);
  }
  return null;
}

// ----------------------------------------------------
// Public API Methods
// ----------------------------------------------------

async function squadSignup({ email, password, username, avatarUrl }) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const cleanUsername = (username || '').trim().replace(/^@/, '');
  if (!cleanUsername) throw new Error('Username is required');

  // Check username uniqueness
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', cleanUsername)
    .maybeSingle();

  if (existingUser) {
    throw new Error(`Username "@${cleanUsername}" is already taken. Please pick another one!`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        user_name: cleanUsername,
        avatar_url: avatarUrl || '⚡'
      }
    }
  });

  if (error) throw error;
  if (!data || !data.user) throw new Error('Signup failed. Please try again.');

  currentUser = data.user;
  currentSession = data.session;
  if (data.session) saveLocalSession(data.session);

  // Upsert profile
  const profilePayload = {
    id: currentUser.id,
    username: cleanUsername,
    display_name: cleanUsername,
    avatar_url: avatarUrl || '⚡',
    is_studying: false,
    today_study_seconds: 0,
    last_heartbeat: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .upsert(profilePayload)
    .select()
    .maybeSingle();

  currentProfile = prof || profilePayload;
  setupRealtimePresence();
  startHeartbeatLoop();

  return {
    success: true,
    user: currentUser,
    profile: currentProfile
  };
}

async function squadLogin({ email, password }) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  if (!data || !data.user) throw new Error('Login failed. Please check your credentials.');

  currentUser = data.user;
  currentSession = data.session;
  if (data.session) saveLocalSession(data.session);

  await fetchAndSyncProfile();
  setupRealtimePresence();
  startHeartbeatLoop();

  return {
    success: true,
    user: currentUser,
    profile: currentProfile
  };
}

async function squadLogout() {
  try {
    if (currentUser && supabase) {
      await supabase.from('profiles').update({
        is_studying: false,
        last_heartbeat: new Date().toISOString()
      }).eq('id', currentUser.id);
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {}

  teardownRealtimePresence();
  clearLocalSession();
  currentUser = null;
  currentSession = null;
  currentProfile = null;

  return { success: true };
}

async function squadGetProfile() {
  if (!currentUser) return null;
  if (!currentProfile) await fetchAndSyncProfile();
  return currentProfile;
}

async function squadUpdateStatus({ isStudying, subject, topic, todayStudySeconds }) {
  if (!currentUser || !supabase) return { success: false, reason: 'not_authenticated' };

  try {
    const payload = {
      is_studying: !!isStudying,
      current_subject: subject || '',
      current_topic: topic || '',
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (typeof todayStudySeconds === 'number') {
      payload.today_study_seconds = todayStudySeconds;
    }

    if (isStudying) {
      payload.session_started_at = new Date().toISOString();
    } else {
      payload.session_started_at = null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', currentUser.id)
      .select()
      .maybeSingle();

    if (!error && data) {
      currentProfile = data;
    }

    return { success: !error };
  } catch (err) {
    console.error('Failed to update squad study status:', err);
    return { success: false, error: err.message };
  }
}

async function squadAddFriend(friendUsername) {
  if (!currentUser || !supabase) throw new Error('Please sign in to add friends');

  const clean = (friendUsername || '').trim().replace(/^@/, '');
  if (!clean) throw new Error('Please enter a username');

  if (currentProfile && currentProfile.username && currentProfile.username.toLowerCase() === clean.toLowerCase()) {
    throw new Error('You cannot add yourself as a friend!');
  }

  // 1. Find profile by username
  const { data: friend, error: findErr } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', clean)
    .maybeSingle();

  if (findErr || !friend) {
    throw new Error(`Student with username "@${clean}" was not found.`);
  }

  // 2. Add reciprocal friendship so both students see each other
  const { error: f1Err } = await supabase
    .from('friendships')
    .upsert({
      user_id: currentUser.id,
      friend_id: friend.id,
      status: 'accepted'
    }, { onConflict: 'user_id,friend_id' });

  if (f1Err) throw f1Err;

  const { error: f2Err } = await supabase
    .from('friendships')
    .upsert({
      user_id: friend.id,
      friend_id: currentUser.id,
      status: 'accepted'
    }, { onConflict: 'user_id,friend_id' });

  if (f2Err) throw f2Err;

  return { success: true, friend };
}

async function squadRemoveFriend(friendId) {
  if (!currentUser || !supabase) throw new Error('Not authenticated');

  await supabase
    .from('friendships')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('friend_id', friendId);

  await supabase
    .from('friendships')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', currentUser.id);

  return { success: true };
}

async function squadGetFriends() {
  if (!currentUser || !supabase) return [];

  try {
    // 1. Get friend IDs
    const { data: friendshipRows, error: fErr } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', currentUser.id);

    if (fErr || !friendshipRows || !friendshipRows.length) return [];

    const friendIds = friendshipRows.map(r => r.friend_id);

    // 2. Fetch friend profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .in('id', friendIds);

    if (pErr || !profiles) return [];

    const now = Date.now();

    // 3. Format friends with deterministic live presence
    return profiles.map(p => {
      const lastHeartbeatMs = p.last_heartbeat ? new Date(p.last_heartbeat).getTime() : 0;
      const diffSeconds = Math.round((now - lastHeartbeatMs) / 1000);

      // Auto-expire ghost states: if no heartbeat in 3 minutes, they are offline
      let presenceState = 'offline';
      if (diffSeconds <= 120 && p.is_studying) {
        presenceState = 'studying';
      } else if (diffSeconds <= 300) {
        presenceState = 'idle';
      } else {
        presenceState = 'offline';
      }

      return {
        id: p.id,
        username: p.username || 'Student',
        displayName: p.display_name || p.username || 'Student',
        avatarUrl: p.avatar_url || '⚡',
        isStudying: presenceState === 'studying',
        presenceState,
        currentSubject: p.current_subject || '',
        currentTopic: p.current_topic || '',
        sessionStartedAt: p.session_started_at || null,
        todayStudySeconds: p.today_study_seconds || 0,
        lastHeartbeat: p.last_heartbeat
      };
    });
  } catch (err) {
    console.error('Failed to get squad friends:', err);
    return [];
  }
}

async function handleAppClose() {
  if (currentUser && supabase) {
    try {
      await supabase.from('profiles').update({
        is_studying: false,
        last_heartbeat: new Date().toISOString()
      }).eq('id', currentUser.id);
    } catch (e) {}
  }
  teardownRealtimePresence();
}

module.exports = {
  initSquadService,
  squadSignup,
  squadLogin,
  squadLogout,
  squadGetProfile,
  squadUpdateStatus,
  squadAddFriend,
  squadRemoveFriend,
  squadGetFriends,
  handleAppClose
};
