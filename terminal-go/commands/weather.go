package commands

import (
	"context"

	"liskovec.dev/terminal/i18n"
	"liskovec.dev/terminal/types"
)

func init() {
	Register("weather", "Generates a vintage weather readout", doWeather, AutocompleteNone)
}

func doWeather(ctx context.Context, session *types.Session, args []string, result *types.ExecResult) []types.Line {
	t := i18n.T()
	return []types.Line{
		{Segments: []types.Segment{bSeg(t.WeatherTitle, "text-highlight")}},
		normalLine(""),
		normalLine(t.WeatherLocation),
		normalLine(""),
		normalLine(t.WeatherSky),
		normalLine(t.WeatherTemp),
		normalLine(t.WeatherWind),
		normalLine(t.WeatherHumidity),
		normalLine(t.WeatherVibes),
		normalLine(""),
		normalLine(t.WeatherForecast),
	}
}
