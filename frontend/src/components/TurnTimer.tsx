import { useEffect, useRef } from "react";
import { Timer } from "lucide-react";
import { soundService } from "../services/soundService";

interface GameTimerProps {
	secondsLeft: number;
	totalSeconds: number;
}

/** Clock is considered "low" once it drops to this many seconds or fewer. */
const LOW_TIME_THRESHOLD = 10;

function formatTime(s: number): string {
	const m = Math.floor(s / 60);
	const sec = Math.max(0, Math.ceil(s % 60));
	return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function GameTimer({ secondsLeft, totalSeconds }: GameTimerProps) {
	const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
	const urgent = secondsLeft <= 60;
	const lowTime = secondsLeft <= LOW_TIME_THRESHOLD;
	const display = formatTime(secondsLeft);

	// Play a warning tick once when the clock crosses into the low-time zone.
	const wasLowRef = useRef(false);
	useEffect(() => {
		if (lowTime && secondsLeft > 0 && !wasLowRef.current) {
			soundService.lowTime();
		}
		wasLowRef.current = lowTime && secondsLeft > 0;
	}, [lowTime, secondsLeft]);

	return (
		<div className="flex items-center gap-2">
			<Timer size={12} className={urgent ? "text-red-500" : "text-(--text-tertiary)"} />
			<span
				className={`font-mono font-bold text-sm tabular-nums ${urgent ? "text-red-500 animate-pulse" : "text-(--text-secondary)"}`}
			>
				{display}
			</span>
			<div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
				<div
					className={`h-full rounded-full transition-all duration-1000 ${
						urgent ? "bg-red-500" : pct > 50 ? "bg-green-500" : "bg-yellow-400"
					}`}
					style={{ width: `${Math.max(0, pct)}%` }}
				/>
			</div>
		</div>
	);
}
