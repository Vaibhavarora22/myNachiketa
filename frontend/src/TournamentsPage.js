
import { Loader, ErrorMessage } from './components.js';
import { useState, useEffect } from 'react';

// Tournaments Page: Fetches and displays ongoing tournaments
const TournamentsPage = () => {
    const [tournaments, setTournaments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTournaments = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('https://lichess.org/api/tournament');
                if (!response.ok) {
                    throw new Error('Failed to fetch tournaments.');
                }
                const data = await response.json();
                const createdAndStarted = [...data.created, ...data.started];
                setTournaments(createdAndStarted);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
    }, []);

    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold mb-6 text-center text-white">Ongoing Tournaments</h2>

            {loading && <Loader />}
            {error && <ErrorMessage message={error} />}

            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {tournaments.length > 0 ? tournaments.map(tourn => (
                        <a key={tourn.id} href={`https://lichess.org/tournament/${tourn.id}`} target="_blank" rel="noopener noreferrer" className="block bg-gray-900 shadow-xl rounded-xl p-6 hover:bg-gray-800 hover:scale-105 transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <h3 className="text-xl font-bold text-white mb-2">{tourn.fullName}</h3>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tourn.isStarted ? 'bg-green-800 text-green-200' : 'bg-blue-800 text-blue-200'}`}>
                                    {tourn.isStarted ? 'Started' : 'Upcoming'}
                                </span>
                            </div>
                            <p className="text-gray-400 mb-4">{tourn.perf?.name}</p>
                            <div className="text-sm space-y-2 text-gray-300">
                                <p><span className="font-semibold text-gray-200">Players:</span> {tourn.nbPlayers}</p>
                                <p><span className="font-semibold text-gray-200">Clock:</span> {tourn.clock.limit / 60}m + {tourn.clock.increment}s</p>
                                <p><span className="font-semibold text-gray-200">Duration:</span> {tourn.minutes} minutes</p>
                            </div>
                            {tourn.greatPlayer?.name && (
                                <p className="text-sm mt-3 text-yellow-300">Featuring: {tourn.greatPlayer.name}</p>
                            )}
                        </a>
                    )) : <p className="col-span-full text-center text-gray-400">No tournaments found at the moment.</p>}
                </div>
            )}
        </div>
    );
};

export default TournamentsPage;
