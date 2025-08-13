import { useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Languages, Check } from "lucide-react";

const languages = [
	{ code: "en", name: "English", flag: "🇺🇸" },
	{ code: "fr", name: "Français", flag: "🇫🇷" },
];

export const LanguageSwitcher = memo(function LanguageSwitcher() {
	const { i18n } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	const currentLanguage =
		languages.find((lang) => lang.code === i18n.language) || languages[0];

	const changeLanguage = (languageCode: string) => {
		i18n.changeLanguage(languageCode);
		setIsOpen(false);
	};

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className="flex items-center space-x-2 px-3 py-2 h-auto rounded-lg hover:bg-gray-50 transition-all duration-200"
				>
					<Languages className="h-4 w-4" />
					<span className="text-lg">{currentLanguage.flag}</span>
					<span className="text-sm font-medium">{currentLanguage.name}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				{languages.map((language) => (
					<DropdownMenuItem
						key={language.code}
						onClick={() => changeLanguage(language.code)}
						className="flex items-center justify-between px-3 py-2 cursor-pointer"
					>
						<div className="flex items-center space-x-3">
							<span className="text-lg">{language.flag}</span>
							<span className="text-sm font-medium">{language.name}</span>
						</div>
						{i18n.language === language.code && (
							<Check className="h-4 w-4 text-blue-600" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
