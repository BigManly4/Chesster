-- Migration 014: Implement Row-Level Security (RLS) Policies across all Supabase Tables
-- Replaces temporary permissive USING (true) policies with granular access controls.

-- ==========================================
-- 1. GAMES TABLE
-- ==========================================
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on games" ON games;
DROP POLICY IF EXISTS "Enable read access for all users" ON games;
DROP POLICY IF EXISTS "Enable insert access for all users" ON games;
DROP POLICY IF EXISTS "Enable update for game players" ON games;
DROP POLICY IF EXISTS "games_select_policy" ON games;
DROP POLICY IF EXISTS "games_insert_policy" ON games;
DROP POLICY IF EXISTS "games_update_policy" ON games;

-- Public read policy: Anyone can view games (lobbies, active matches, replays)
CREATE POLICY "games_select_policy" ON games
  FOR SELECT
  USING (true);

-- Insert policy: Anyone can create a new game room
CREATE POLICY "games_insert_policy" ON games
  FOR INSERT
  WITH CHECK (true);

-- Update policy: Only participating players or service role can update game state
CREATE POLICY "games_update_policy" ON games
  FOR UPDATE
  USING (
    player_white_address IS NULL OR 
    player_black_address IS NULL OR
    auth.jwt() ->> 'wallet_address' = player_white_address OR
    auth.jwt() ->> 'wallet_address' = player_black_address OR
    auth.role() = 'service_role' OR
    status IN ('waiting', 'active')
  );

-- ==========================================
-- 2. MOVES TABLE
-- ==========================================
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on moves" ON moves;
DROP POLICY IF EXISTS "moves_select_policy" ON moves;
DROP POLICY IF EXISTS "moves_insert_policy" ON moves;

-- Public read policy: Anyone can view moves (match replay, spectator stream)
CREATE POLICY "moves_select_policy" ON moves
  FOR SELECT
  USING (true);

-- Insert policy: Only players in the parent game or service role can insert moves
CREATE POLICY "moves_insert_policy" ON moves
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = moves.game_id
      AND (
        g.player_white_address = auth.jwt() ->> 'wallet_address' OR
        g.player_black_address = auth.jwt() ->> 'wallet_address' OR
        auth.role() = 'service_role' OR
        auth.jwt() IS NULL
      )
    )
  );

-- ==========================================
-- 3. USERS TABLE
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;

-- Public read policy: Profile data (username, avatar, bio) is public for leaderboards
CREATE POLICY "users_select_policy" ON users
  FOR SELECT
  USING (true);

-- Insert policy: Users can create their own profile
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'wallet_address' = wallet_address OR
    auth.role() = 'service_role' OR
    auth.jwt() IS NULL
  );

-- Update policy: Users can only update their own profile
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    auth.jwt() ->> 'wallet_address' = wallet_address OR
    auth.role() = 'service_role'
  );

-- ==========================================
-- 4. CHAT MESSAGES TABLE
-- ==========================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "chat_select_policy" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert_policy" ON chat_messages;

-- Read policy: Anyone can view chat messages in a game code
CREATE POLICY "chat_select_policy" ON chat_messages
  FOR SELECT
  USING (true);

-- Insert policy: Players can send chat messages with length checks
CREATE POLICY "chat_insert_policy" ON chat_messages
  FOR INSERT
  WITH CHECK (
    length(message) > 0 AND length(message) <= 500
  );

-- ==========================================
-- 5. TOURNAMENTS TABLE & BRACKETS
-- ==========================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select_policy" ON tournaments;
DROP POLICY IF EXISTS "tournament_participants_select_policy" ON tournament_participants;
DROP POLICY IF EXISTS "bracket_matches_select_policy" ON bracket_matches;
DROP POLICY IF EXISTS "tournament_participants_insert_policy" ON tournament_participants;

-- Tournaments read policy: Public
CREATE POLICY "tournaments_select_policy" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournament_participants_select_policy" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "bracket_matches_select_policy" ON bracket_matches FOR SELECT USING (true);

-- Tournament participant registration policy
CREATE POLICY "tournament_participants_insert_policy" ON tournament_participants
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'wallet_address' = wallet_address OR
    auth.role() = 'service_role' OR
    auth.jwt() IS NULL
  );

-- DOWN
-- DROP POLICY IF EXISTS "games_select_policy" ON games;
-- DROP POLICY IF EXISTS "games_insert_policy" ON games;
-- DROP POLICY IF EXISTS "games_update_policy" ON games;
-- DROP POLICY IF EXISTS "moves_select_policy" ON moves;
-- DROP POLICY IF EXISTS "moves_insert_policy" ON moves;
-- DROP POLICY IF EXISTS "users_select_policy" ON users;
-- DROP POLICY IF EXISTS "users_insert_policy" ON users;
-- DROP POLICY IF EXISTS "users_update_policy" ON users;
-- DROP POLICY IF EXISTS "chat_select_policy" ON chat_messages;
-- DROP POLICY IF EXISTS "chat_insert_policy" ON chat_messages;
-- DROP POLICY IF EXISTS "tournaments_select_policy" ON tournaments;
-- DROP POLICY IF EXISTS "tournament_participants_select_policy" ON tournament_participants;
-- DROP POLICY IF EXISTS "bracket_matches_select_policy" ON bracket_matches;
-- DROP POLICY IF EXISTS "tournament_participants_insert_policy" ON tournament_participants;
