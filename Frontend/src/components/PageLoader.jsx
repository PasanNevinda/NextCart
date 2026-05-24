import {LoaderIcon} from "lucide-react"

const PageLoader = () => {
    return (
        <div className="flex h-screen items-center justify-center">
            <LoaderIcon className="size-10 animate-spin text-primary"></LoaderIcon>
        </div>
    )
}

export default PageLoader;