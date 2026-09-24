const supabase = require("../config/supabase");

class TournamentModel {
	/**
	 * Creates a new tournament record.
	 *
	 * @param {object} params
	 * @param {string} [params.id]
	 * @param {string} params.name
	 * @param {string} [params.status='open']
	 * @param {number} [params.max_players=8]
	 * @returns {Promise<object>}
	 */
	async createTournament({ id, name, status = "open", max_players = 8 }) {
		const payload = {
			name,
			status,
			max_players,
		};
		if (id) payload.id = id;

		const { data, error } = await supabase
			.from("tournaments")
			.insert(payload)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Retrieves tournament by UUID.
	 *
	 * @param {string} id
	 * @returns {Promise<object|null>}
	 */
	async getTournament(id) {
		const { data, error } = await supabase
			.from("tournaments")
			.select("*")
			.eq("id", id)
			.single();

		if (error && error.code !== "PGRST116") throw error;
		return data || null;
	}

	/**
	 * Updates tournament status (draft, open, in_progress, completed, cancelled).
	 *
	 * @param {string} id
	 * @param {string} status
	 * @returns {Promise<object>}
	 */
	async updateTournamentStatus(id, status) {
		const { data, error } = await supabase
			.from("tournaments")
			.update({ status, updated_at: new Date().toISOString() })
			.eq("id", id)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Adds a participant to a tournament.
	 *
	 * @param {string} tournamentId
	 * @param {string} walletAddress
	 * @param {number|null} [seed=null]
	 * @returns {Promise<object>}
	 */
	async addParticipant(tournamentId, walletAddress, seed = null) {
		const { data, error } = await supabase
			.from("tournament_participants")
			.insert({
				tournament_id: tournamentId,
				wallet_address: walletAddress,
				seed,
			})
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Retrieves participants for a tournament ordered by seed.
	 *
	 * @param {string} tournamentId
	 * @returns {Promise<Array<object>>}
	 */
	async getParticipants(tournamentId) {
		const { data, error } = await supabase
			.from("tournament_participants")
			.select("*")
			.eq("tournament_id", tournamentId)
			.order("seed", { ascending: true, nullsFirst: false });

		if (error) throw error;
		return data || [];
	}

	/**
	 * Bulk inserts matches into bracket_matches table.
	 *
	 * @param {Array<object>} matches
	 * @returns {Promise<Array<object>>}
	 */
	async createBracketMatches(matches) {
		if (!matches || matches.length === 0) return [];

		const { data, error } = await supabase
			.from("bracket_matches")
			.insert(matches)
			.select();

		if (error) throw error;
		return data || [];
	}

	/**
	 * Retrieves all bracket matches for a tournament ordered by round and match_number.
	 *
	 * @param {string} tournamentId
	 * @returns {Promise<Array<object>>}
	 */
	async getBracketMatches(tournamentId) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.select("*")
			.eq("tournament_id", tournamentId)
			.order("round", { ascending: true })
			.order("match_number", { ascending: true });

		if (error) throw error;
		return data || [];
	}

	/**
	 * Retrieves a single bracket match by its ID.
	 *
	 * @param {string} matchId
	 * @returns {Promise<object|null>}
	 */
	async getMatchById(matchId) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.select("*")
			.eq("id", matchId)
			.single();

		if (error && error.code !== "PGRST116") throw error;
		return data || null;
	}

	/**
	 * Retrieves a bracket match by tournament, round, and match_number.
	 *
	 * @param {string} tournamentId
	 * @param {number} round
	 * @param {number} matchNumber
	 * @returns {Promise<object|null>}
	 */
	async getMatchByTournamentRoundMatchNumber(tournamentId, round, matchNumber) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.select("*")
			.eq("tournament_id", tournamentId)
			.eq("round", round)
			.eq("match_number", matchNumber)
			.single();

		if (error && error.code !== "PGRST116") throw error;
		return data || null;
	}

	/**
	 * Retrieves a bracket match by associated game code.
	 *
	 * @param {string} gameCode
	 * @returns {Promise<object|null>}
	 */
	async getMatchByGameCode(gameCode) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.select("*")
			.eq("game_code", gameCode)
			.single();

		if (error && error.code !== "PGRST116") throw error;
		return data || null;
	}

	/**
	 * Updates the status of a bracket match.
	 *
	 * @param {string} matchId
	 * @param {string} status ('pending', 'ready', 'in_progress', 'completed', 'bye')
	 * @returns {Promise<object>}
	 */
	async updateBracketMatchStatus(matchId, status) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.update({ status })
			.eq("id", matchId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Sets the winner of a match and marks it completed.
	 *
	 * @param {string} matchId
	 * @param {string} winnerAddress
	 * @returns {Promise<object>}
	 */
	async setMatchWinner(matchId, winnerAddress) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.update({
				winner: winnerAddress,
				status: "completed",
			})
			.eq("id", matchId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Locates the downstream next-round match that the given match feeds into.
	 *
	 * @param {string} tournamentId
	 * @param {string} matchId
	 * @returns {Promise<object|null>}
	 */
	async getNextRoundMatch(tournamentId, matchId) {
		const current = await this.getMatchById(matchId);
		if (!current) return null;

		const nextRound = current.round + 1;
		const nextMatchNumber = Math.ceil(current.match_number / 2);

		return this.getMatchByTournamentRoundMatchNumber(
			tournamentId,
			nextRound,
			nextMatchNumber,
		);
	}

	/**
	 * Assigns a player address to a bracket match slot (player_one or player_two).
	 *
	 * @param {string} matchId
	 * @param {string} playerAddress
	 * @param {string} [slot] - Optional: 'player_one' or 'player_two'
	 * @returns {Promise<object>}
	 */
	async assignPlayerToMatch(matchId, playerAddress, slot = null) {
		const current = await this.getMatchById(matchId);
		if (!current) throw new Error(`Bracket match not found: ${matchId}`);

		let targetSlot = slot;
		if (!targetSlot) {
			if (!current.player_one) {
				targetSlot = "player_one";
			} else if (!current.player_two) {
				targetSlot = "player_two";
			} else {
				throw new Error(`Match ${matchId} already has two players assigned`);
			}
		}

		const updatePayload = {
			[targetSlot]: playerAddress,
		};

		// Check if match is now ready to play
		const finalP1 = targetSlot === "player_one" ? playerAddress : current.player_one;
		const finalP2 = targetSlot === "player_two" ? playerAddress : current.player_two;

		if (finalP1 && finalP2 && current.status === "pending") {
			updatePayload.status = "ready";
		}

		const { data, error } = await supabase
			.from("bracket_matches")
			.update(updatePayload)
			.eq("id", matchId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	/**
	 * Links an instantiated game code to a bracket match and marks it in_progress.
	 *
	 * @param {string} matchId
	 * @param {string} gameCode
	 * @returns {Promise<object>}
	 */
	async linkGameToMatch(matchId, gameCode) {
		const { data, error } = await supabase
			.from("bracket_matches")
			.update({
				game_code: gameCode,
				status: "in_progress",
			})
			.eq("id", matchId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}
}

module.exports = new TournamentModel();
