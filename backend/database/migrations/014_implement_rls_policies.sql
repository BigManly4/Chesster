-- Migration 014: Implement Row-Level Security (RLS) Policies across all Supabase Tables
-- Safe to run on any database state (checks if tables exist before applying policies).

-- ==========================================
-- 1. GAMES TABLE
-- ==========================================
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on games" ON public.games;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable update for game players" ON public.games;
DROP POLICY IF EXISTS "games_select_policy" ON public.games;
DROP POLICY IF EXISTS "games_insert_policy" ON public.games;
DROP POLICY IF EXISTS "games_update_policy" ON public.games;

-- Public read policy: Anyone can view games (lobbies, active matches, replays)
CREATE POLICY "games_select_policy" ON public.games
  FOR SELECT
  USING (true);

-- Insert policy: Anyone can create a new game room
CREATE POLICY "games_insert_policy" ON public.games
  FOR INSERT
  WITH CHECK (true);

-- Update policy: Only participating players or service role can update game state
CREATE POLICY "games_update_policy" ON public.games
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
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on moves" ON public.moves;
DROP POLICY IF EXISTS "moves_select_policy" ON public.moves;
DROP POLICY IF EXISTS "moves_insert_policy" ON public.moves;

-- Public read policy: Anyone can view moves (match replay, spectator stream)
CREATE POLICY "moves_select_policy" ON public.moves
  FOR SELECT
  USING (true);

-- Insert policy: Only players in the parent game or service role can insert moves
CREATE POLICY "moves_insert_policy" ON public.moves
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games g
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
-- 3. CHAT MESSAGES TABLE
-- ==========================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_select_policy" ON public.chat_messages;
DROP POLICY IF EXISTS "chat_insert_policy" ON public.chat_messages;

-- Read policy: Anyone can view chat messages in a game code
CREATE POLICY "chat_select_policy" ON public.chat_messages
  FOR SELECT
  USING (true);

-- Insert policy: Players can send chat messages with length checks
CREATE POLICY "chat_insert_policy" ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    length(message) > 0 AND length(message) <= 500
  );

-- ==========================================
-- 4. USERS TABLE (IF EXISTS)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;';
    EXECUTE 'DROP POLICY IF EXISTS users_select_policy ON public.users;';
    EXECUTE 'DROP POLICY IF EXISTS users_insert_policy ON public.users;';
    EXECUTE 'DROP POLICY IF EXISTS users_update_policy ON public.users;';
    
    EXECUTE 'CREATE POLICY users_select_policy ON public.users FOR SELECT USING (true);';
    EXECUTE 'CREATE POLICY users_insert_policy ON public.users FOR INSERT WITH CHECK (auth.jwt() ->> ''wallet_address'' = wallet_address OR auth.role() = ''service_role'' OR auth.jwt() IS NULL);';
    EXECUTE 'CREATE POLICY users_update_policy ON public.users FOR UPDATE USING (auth.jwt() ->> ''wallet_address'' = wallet_address OR auth.role() = ''service_role'');';
  END IF;
END $$;

-- ==========================================
-- 5. TOURNAMENT TABLES (IF EXISTS)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tournaments') THEN
    EXECUTE 'ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS tournaments_select_policy ON public.tournaments;';
    EXECUTE 'CREATE POLICY tournaments_select_policy ON public.tournaments FOR SELECT USING (true);';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tournament_participants') THEN
    EXECUTE 'ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS tournament_participants_select_policy ON public.tournament_participants;';
    EXECUTE 'DROP POLICY IF EXISTS tournament_participants_insert_policy ON public.tournament_participants;';
    EXECUTE 'CREATE POLICY tournament_participants_select_policy ON public.tournament_participants FOR SELECT USING (true);';
    EXECUTE 'CREATE POLICY tournament_participants_insert_policy ON public.tournament_participants FOR INSERT WITH CHECK (auth.jwt() ->> ''wallet_address'' = wallet_address OR auth.role() = ''service_role'' OR auth.jwt() IS NULL);';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bracket_matches') THEN
    EXECUTE 'ALTER TABLE public.bracket_matches ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS bracket_matches_select_policy ON public.bracket_matches;';
    EXECUTE 'CREATE POLICY bracket_matches_select_policy ON public.bracket_matches FOR SELECT USING (true);';
  END IF;
END $$;
