import React, { useState, useEffect } from 'react';
import { Loader, ErrorMessage } from './components.js';

// Leaderboard Page: Fetches and displays top players
const LeaderboardPage = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [variant, setVariant] = useState('blitz');
    const variants = ['bullet', 'blitz', 'rapid', 'classical', 'ultraBullet', 'crazyhouse', 'chess960'];

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`https://lichess.org/api/player/top/10/${variant}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard data.');
                }
                const data = await response.json();
                setLeaderboard(data.users);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [variant]);
    
    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 text-center text-white">Top 10 Players</h2>
            
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {variants.map(v => (
                    <button 
                        key={v}
                        onClick={() => setVariant(v)}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition ${variant === v ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1).replace('Bullet', ' Bullet').replace('house', 'house')}
                    </button>
                ))}
            </div>

            {loading && <Loader />}
            {error && <ErrorMessage message={error} />}
            
            {!loading && !error && (
                <div className="bg-gray-900 shadow-2xl rounded-xl p-4 max-w-3xl mx-auto">
                    <ul className="divide-y divide-gray-800">
                        {leaderboard.map((player, index) => (
                            <li key={player.id} className="flex items-center p-4 hover:bg-gray-800/50 rounded-lg transition-colors duration-200">
                                <div className="w-10 text-center font-bold text-gray-400">{index + 1}</div>
                                <div className="flex-shrink-0 ml-4">
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-teal-400">
                                        {player.username.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="ml-4 flex-grow">
                                    <p className="text-lg font-semibold text-white">
                                        {player.username}
                                        {player.title && <span className="ml-2 text-yellow-400 text-sm">{player.title}</span>}
                                    </p>
                                    <p className="text-sm text-gray-500">{player.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-white">{player.perfs[variant]?.rating}</p>
                                    <p className="text-sm text-gray-400">{variant}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default LeaderboardPage;
