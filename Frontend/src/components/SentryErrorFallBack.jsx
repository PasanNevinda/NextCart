import { Link } from "react-router";

export function SentryErrorFallBack() {
    return (
        <div className="mx-auto max-w-md rounded-box border border-base-300 bg-base-100 p-8 text-center">
            <p className="text-base-content">Something went wrong. the error has been reported</p>
            <Link to="/" className="btn btn-primary btn-sm mt-6">
                Go back to shop
            </Link>
        </div>
    );
}