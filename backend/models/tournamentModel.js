const supabase = require("../config/supabase");

const TOURNAMENT_STATUSES = ["draft", "open", "active", "in_progress", "completed", "cancelled"];
const PARTICIPANT_STATUSES = ["active", "eliminated", "withdrawn", "disqualified"];
const MATCH_STATUSES = ["pending", "ready", "in_progress", "completed", "bye", "cancelled"];

/**
 * TournamentModel — Supabase helpers for tournaments, participants, and bracket matches.
 * Backed by migrations 010 + 016 (016_create_tournament_tables.sql).
 */
class TournamentModel {
	async createTournament({
		name,
		title = null,
		maxPlayers,
		entryFee = 0,
		coordinatorAddress = null,
		status = "open",
	}) {
		if (!name) throw new Error("Tournament name is required");
		if (!maxPlayers || maxPlayers < 2) throw new Error("maxPlayers must be >= 2");
		if (!TOURNAMENT_STATUSES.includes(status)) {
			throw new Error(`Invalid tournament status: ${status}`);
		}

		const payload = {
			name,
			title: title || name,
			max_players: maxPlayers,
			entry_fee: entryFee,
			coordinator_address: coordinatorAddress,
			status,
			current_round: 0,
		};

		const { data, error } = await supabase
			.from("tournaments")
			.insert(payload)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async getTournament(tournamentId) {
		const { data, error } = await supabase
			.from("tournaments")
			.select("*")
			.eq("id", tournamentId)
			.maybeSingle();

		if (error) throw error;
		return data;
	}

	async listTournaments({ status = null, limit = 50 } = {}) {
		let query = supabase
			.from("tournaments")
			.select("*")
			.order("created_at", { ascending: false })
			.limit(Math.min(100, Math.max(1, limit)));

		if (status) query = query.eq("status", status);

		const { data, error } = await query;
		if (error) throw error;
		return data || [];
	}

	async updateTournamentStatus(tournamentId, status, extra = {}) {
		if (!TOURNAMENT_STATUSES.includes(status)) {
			throw new Error(`Invalid tournament status: ${status}`);
		}

		const updates = {
			status,
			updated_at: new Date().toISOString(),
			...extra,
		};

		const { data, error } = await supabase
			.from("tournaments")
			.update(updates)
			.eq("id", tournamentId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async registerParticipant(tournamentId, walletAddress, seedNumber = null) {
		if (!walletAddress) throw new Error("walletAddress is required");

		const tournament = await this.getTournament(tournamentId);
		if (!tournament) throw new Error("Tournament not found");
		if (!["open", "draft"].includes(tournament.status)) {
			throw new Error("Tournament is not open for registration");
		}

		const payload = {
			tournament_id: tournamentId,
			wallet_address: walletAddress,
			seed_number: seedNumber,
			seed: seedNumber,
			status: "active",
			registered_at: new Date().toISOString(),
			joined_at: new Date().toISOString(),
		};

		const { data, error } = await supabase
			.from("tournament_participants")
			.insert(payload)
			.select()
			.single();

		if (error) {
			if (error.code === "23505") {
				throw new Error("Wallet already registered for this tournament");
			}
			throw error;
		}
		return data;
	}

	async listParticipants(tournamentId) {
		const { data, error } = await supabase
			.from("tournament_participants")
			.select("*")
			.eq("tournament_id", tournamentId)
			.order("seed_number", { ascending: true, nullsFirst: false });

		if (error) throw error;
		return data || [];
	}

	async updateParticipantStatus(tournamentId, walletAddress, status) {
		if (!PARTICIPANT_STATUSES.includes(status)) {
			throw new Error(`Invalid participant status: ${status}`);
		}

		const { data, error } = await supabase
			.from("tournament_participants")
			.update({ status })
			.eq("tournament_id", tournamentId)
			.eq("wallet_address", walletAddress)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async createBracketMatch({
		tournamentId,
		round,
		matchNumber,
		playerOne = null,
		playerTwo = null,
		dependsOnMatchA = null,
		dependsOnMatchB = null,
		nextMatchId = null,
		status = "pending",
	}) {
		if (!tournamentId) throw new Error("tournamentId is required");
		if (!round || round < 1) throw new Error("round must be >= 1");
		if (!matchNumber || matchNumber < 1) throw new Error("matchNumber must be >= 1");
		if (!MATCH_STATUSES.includes(status)) {
			throw new Error(`Invalid match status: ${status}`);
		}

		const payload = {
			tournament_id: tournamentId,
			round,
			match_number: matchNumber,
			player_one: playerOne,
			player_two: playerTwo,
			player_white: playerOne,
			player_black: playerTwo,
			depends_on_match_a: dependsOnMatchA,
			depends_on_match_b: dependsOnMatchB,
			next_match_id: nextMatchId,
			status,
		};

		const { data, error } = await supabase
			.from("bracket_matches")
			.insert(payload)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async listBracketMatches(tournamentId, { round = null } = {}) {
		let query = supabase
			.from("bracket_matches")
			.select("*")
			.eq("tournament_id", tournamentId)
			.order("round", { ascending: true })
			.order("match_number", { ascending: true });

		if (round != null) query = query.eq("round", round);

		const { data, error } = await query;
		if (error) throw error;
		return data || [];
	}

	async resolveMatch(matchId, winnerAddress, { gameCode = null, payoutTxHash = null } = {}) {
		if (!winnerAddress) throw new Error("winnerAddress is required");

		const updates = {
			winner: winnerAddress,
			winner_address: winnerAddress,
			status: "completed",
			updated_at: new Date().toISOString(),
		};
		if (gameCode) updates.game_code = gameCode;
		if (payoutTxHash) updates.payout_tx_hash = payoutTxHash;

		const { data, error } = await supabase
			.from("bracket_matches")
			.update(updates)
			.eq("id", matchId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async setTournamentWinner(tournamentId, winnerAddress, payoutTxHash = null) {
		return this.updateTournamentStatus(tournamentId, "completed", {
			winner_address: winnerAddress,
			payout_tx_hash: payoutTxHash,
		});
	}

	async advanceRound(tournamentId, nextRound) {
		if (!nextRound || nextRound < 1) throw new Error("nextRound must be >= 1");

		const { data, error } = await supabase
			.from("tournaments")
			.update({
				current_round: nextRound,
				status: "active",
				updated_at: new Date().toISOString(),
			})
			.eq("id", tournamentId)
			.select()
			.single();

		if (error) throw error;
		return data;
	}

	async getBracketTree(tournamentId) {
		const [tournament, participants, matches] = await Promise.all([
			this.getTournament(tournamentId),
			this.listParticipants(tournamentId),
			this.listBracketMatches(tournamentId),
		]);

		if (!tournament) throw new Error("Tournament not found");

		const byRound = {};
		for (const match of matches) {
			const key = String(match.round);
			if (!byRound[key]) byRound[key] = [];
			byRound[key].push(match);
		}

		return { tournament, participants, matches, byRound };
	}
}

module.exports = new TournamentModel();
