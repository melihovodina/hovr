package rag

import (
	"context"
	"math"
	"os"
	"sort"
	"testing"

	"github.com/melihovodina/hovr/server/internal/ai"
)

// TestCalibrateThreshold prints real Gemini scores to pick MinScore.
//
//	HOVR_CALIBRATE=1 GEMINI_API_KEY=... go test ./internal/rag -run Calibrate -v
func TestCalibrateThreshold(t *testing.T) {
	if os.Getenv("HOVR_CALIBRATE") == "" || os.Getenv("GEMINI_API_KEY") == "" {
		t.Skip("set HOVR_CALIBRATE=1 and GEMINI_API_KEY to run")
	}
	ctx := context.Background()
	embedder, err := ai.NewEmbedder(ctx, os.Getenv("GEMINI_API_KEY"))
	if err != nil {
		t.Fatal(err)
	}

	titles := make([]string, len(calibrationDocs))
	inputs := make([]string, len(calibrationDocs))
	for i, d := range calibrationDocs {
		titles[i] = d.title
		inputs[i] = d.title + "\n\n" + d.text // same as the worker
	}
	docVecs, err := embedder.EmbedDocuments(ctx, inputs)
	if err != nil {
		t.Fatal(err)
	}

	type result struct {
		group, question, best string
		score                 float64
	}
	var results []result
	for _, group := range []string{"covered", "uncovered", "off-topic"} {
		for _, q := range calibrationQuestions[group] {
			qv, err := embedder.EmbedQuery(ctx, q)
			if err != nil {
				t.Fatal(err)
			}
			best, bestScore := "", -1.0
			for i, dv := range docVecs {
				if s := cosine(qv, dv); s > bestScore {
					best, bestScore = titles[i], s
				}
			}
			results = append(results, result{group, q, best, bestScore})
		}
	}

	sort.SliceStable(results, func(i, j int) bool { return results[i].score > results[j].score })
	for _, r := range results {
		t.Logf("%.3f  %-10s %-48s → %s", r.score, r.group, r.question, r.best)
	}

	// Wrong refusals and wrong passes per threshold.
	t.Log("threshold  refused-covered  passed-uncovered  passed-off-topic")
	for th := 0.50; th <= 0.75; th += 0.01 {
		var refused, passedUncovered, passedOff int
		for _, r := range results {
			switch {
			case r.group == "covered" && r.score < th:
				refused++
			case r.group == "uncovered" && r.score >= th:
				passedUncovered++
			case r.group == "off-topic" && r.score >= th:
				passedOff++
			}
		}
		t.Logf("  %.2f       %2d / %d            %2d / %d             %2d / %d", th,
			refused, len(calibrationQuestions["covered"]),
			passedUncovered, len(calibrationQuestions["uncovered"]),
			passedOff, len(calibrationQuestions["off-topic"]))
	}
}

func cosine(a, b []float32) float64 {
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

var calibrationDocs = []struct{ title, text string }{
	{"Shipping & delivery", `We ship to the United States, Canada and the United Kingdom. Orders to the US arrive in 2 to 4 business days, to Canada in 5 to 8 business days and to the UK in 6 to 10 business days. Shipping is free on orders over $40. Every order comes with a tracking link by email. For Canada and the UK, duties and taxes are paid at checkout, so there is nothing to pay on delivery.`},
	{"Returns & refunds", `You can return unopened bags within 30 days of delivery. If a bag arrives damaged or torn, email us a photo and we send a replacement for free. Refunds go back to the original payment method within 5 to 7 business days after we receive the return.`},
	{"Subscriptions", `Subscriptions deliver fresh coffee every 2 or 4 weeks. You can pause, skip a delivery, change your coffee or cancel at any time from your account page. Shipping is always free on subscription orders.`},
	{"Payment methods", `We accept Visa, Mastercard, American Express, PayPal, Apple Pay and Northwind gift cards. We do not accept cryptocurrency or cash on delivery.`},
	{"Brewing guide", `For espresso, use 18 grams of finely ground coffee for a double shot. For pour-over, use a ratio of 1 gram of coffee to 16 grams of water with a medium-fine grind. For French press, use a coarse grind and steep for 4 minutes. Water should be between 92 and 96 degrees Celsius.`},
	{"Storing your coffee", `Keep beans in an airtight container away from light, heat and moisture. Don't store coffee in the fridge or freezer. For the best flavour, use the beans within 4 weeks of the roast date printed on the bag.`},
	{"Wholesale", `We supply cafes, restaurants and offices. The minimum wholesale order is 5 kilograms. Write to wholesale@northwind.example for prices.`},
	{"Our coffee", `We roast every Tuesday and Thursday. Our single origins come from Ethiopia, Colombia and Guatemala. Our decaf is made with the Swiss Water process, without chemicals.`},
	{"Grinders & equipment", `We sell hand grinders, electric burr grinders and gooseneck kettles. All equipment comes with a one-year warranty.`},
	{"Contact us", `Email support@northwind.example. We answer Monday to Friday, 9am to 5pm Pacific time, usually within a day. We don't have a phone line.`},
}

var calibrationQuestions = map[string][]string{
	"covered": {
		"do you deliver to Toronto?",
		"how long until my order gets to England?",
		"is shipping free?",
		"can I send back a bag I already opened?",
		"my bag arrived torn, what do I do?",
		"when will I get my money back?",
		"can I skip next month's delivery?",
		"how do I stop my subscription?",
		"do you take Apple Pay?",
		"can I pay with bitcoin?",
		"how much coffee for a double espresso?",
		"what water temperature should I use?",
		"should I keep beans in the fridge?",
		"do you sell to cafes?",
		"do you have decaf?",
		"is there a warranty on the grinders?",
		"what are your support hours?",
		"can I call you?",
		"where do your beans come from?",
		"when do you roast?",
	},
	"uncovered": {
		"do you sell espresso machines?",
		"do you have a shop in Portland I can visit?",
		"do you offer corporate gift boxes?",
		"are your beans organic?",
		"is your packaging recyclable?",
		"do you have a loyalty program?",
		"how much caffeine is in your espresso blend?",
		"can I change the delivery address after ordering?",
		"do you have student discounts?",
		"are you hiring baristas?",
	},
	"off-topic": {
		"what's the weather tomorrow?",
		"write me a poem about cats",
		"who won the world cup in 2022?",
		"how do I fix my car's brakes?",
		"what is the capital of France?",
	},
}
