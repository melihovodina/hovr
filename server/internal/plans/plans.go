// Package plans defines what each pricing plan allows.
package plans

// Plan matches the "plan" enum in the database.
type Plan string

const (
	Free     Plan = "free"
	Pro      Plan = "pro"
	Business Plan = "business"
)

// Limits are the per-account allowances of a plan.
type Limits struct {
	Bots             int  `json:"bots"`
	MessagesPerMonth int  `json:"messagesPerMonth"`
	Sources          int  `json:"sources"`
	RemoveBadge      bool `json:"removeBadge"`
	ExportLeads      bool `json:"exportLeads"`
	// HistoryDays is how long inbox and leads are kept; 0 means forever.
	HistoryDays int `json:"historyDays"`
}

var limits = map[Plan]Limits{
	Free:     {Bots: 1, MessagesPerMonth: 100, Sources: 10, HistoryDays: 7},
	Pro:      {Bots: 3, MessagesPerMonth: 2000, Sources: 100, RemoveBadge: true},
	Business: {Bots: 10, MessagesPerMonth: 10000, Sources: 500, RemoveBadge: true, ExportLeads: true},
}

// For returns the limits of p; unknown plans get the free limits.
func For(p Plan) Limits {
	if l, ok := limits[p]; ok {
		return l
	}
	return limits[Free]
}

// Name is the plan name as shown to people.
func (p Plan) Name() string {
	switch p {
	case Pro:
		return "Pro"
	case Business:
		return "Business"
	default:
		return "Free"
	}
}
