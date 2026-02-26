const loanAmountInput = document.getElementById('loanAmount');
const interestRateInput = document.getElementById('interestRate');
const loanTermInput = document.getElementById('loanTerm');
const extraPaymentInput = document.getElementById('extraPayment');
const initialPortfolioInput = document.getElementById('initialPortfolio');
const marketReturnInput = document.getElementById('marketReturn');
const homeValueInput = document.getElementById('homeValue');
const homeAppreciationRateInput = document.getElementById('homeAppreciationRate');

const monthlyPaymentVal = document.getElementById('monthlyPaymentVal');
const totalInterestVal = document.getElementById('totalInterestVal');
const totalCostVal = document.getElementById('totalCostVal');

const mortgageTimeframeInput = document.getElementById('mortgageTimeframe');
const portfolioTimeframeInput = document.getElementById('portfolioTimeframe');
const netWorthTimeframeInput = document.getElementById('netWorthTimeframe');

let mortgageChart = null;
let portfolioChart = null;
let netWorthChart = null;

// Store full data so inputs don't require full recalculation
let fullDataStore = {};

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(num);
}

function calculateMortgage() {
    const P = parseFloat(loanAmountInput.value);
    const rAnnual = parseFloat(interestRateInput.value);
    const years = parseFloat(loanTermInput.value);
    const extra = (extraPaymentInput && extraPaymentInput.value) ? parseFloat(extraPaymentInput.value) : 0;
    const initialPortfolio = (initialPortfolioInput && initialPortfolioInput.value) ? parseFloat(initialPortfolioInput.value) : 0;
    const marketReturnPercent = (marketReturnInput && marketReturnInput.value) ? parseFloat(marketReturnInput.value) : 0;
    const initialHomeValue = (homeValueInput && homeValueInput.value) ? parseFloat(homeValueInput.value) : P;
    const homeAppreciationPercent = (homeAppreciationRateInput && homeAppreciationRateInput.value) ? parseFloat(homeAppreciationRateInput.value) : 0;

    // Initial validation
    if (isNaN(P) || isNaN(rAnnual) || isNaN(years) || P <= 0 || rAnnual <= 0 || years <= 0 || isNaN(extra) || extra < 0) {
        return;
    }

    const r = (rAnnual / 100) / 12; // Monthly interest rate
    const n = years * 12; // Total number of payments

    // Monthly Payment Calculation
    // M = P [ i(1 + i)^n ] / [ (1 + i)^n - 1]
    const baseMonthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const actualMonthlyPayment = baseMonthlyPayment + extra;

    // Arrays for chart
    const labels = []; // Time labels (years)
    const balanceData = []; // Line Chart (per year/month)
    const interestPerMonthData = []; // Line Chart
    const principalPerYearData = []; // Bar Chart
    const portfolioData = []; // Line Chart
    const portfolioPaymentData = []; // Line Chart
    const homeEquityData = []; // Line Chart
    const netWorthData = []; // Line Chart

    let currentBalance = P;
    let totalInterest = 0;
    const downpayment = Math.max(0, initialHomeValue - P);
    let currentPortfolio = initialPortfolio - downpayment;
    let currentHomeValue = initialHomeValue;

    let annualPrincipalAccumulator = 0;

    // Simulate 60 years to see long-term net worth
    const maxMonths = 60 * 12;
    const rMarket = (marketReturnPercent / 100) / 12; // Monthly market return
    const rHome = (homeAppreciationPercent / 100) / 12; // Monthly home appreciation

    let previousBalance = currentBalance;

    for (let month = 1; month <= maxMonths; month++) {
        let interestForMonth = 0;
        let principalForMonth = 0;
        let paymentFromPortfolio = 0;

        if (currentBalance > 0) {
            interestForMonth = currentBalance * r;
            principalForMonth = actualMonthlyPayment - interestForMonth;

            if (principalForMonth > currentBalance) {
                principalForMonth = currentBalance; // final payoff
            }

            paymentFromPortfolio = interestForMonth + principalForMonth;
            currentBalance -= principalForMonth;
            if (currentBalance < 0) currentBalance = 0;
        }

        // Portfolio changes (grow by return, then subtract payment)
        currentPortfolio += currentPortfolio * rMarket;
        currentPortfolio -= paymentFromPortfolio;

        currentHomeValue += currentHomeValue * rHome;

        annualPrincipalAccumulator += principalForMonth;
        totalInterest += interestForMonth;

        const isPayoffMonth = (currentBalance === 0 && previousBalance > 0);

        if (month % 12 === 0 || isPayoffMonth || (month === n && currentBalance > 0)) {
            const year = month % 12 === 0 ? month / 12 : Number((month / 12).toFixed(1));
            const yearLabel = `Year ${year}`;

            if (labels.length === 0 || labels[labels.length - 1] !== yearLabel) {
                labels.push(yearLabel);
                balanceData.push(currentBalance);
                interestPerMonthData.push(interestForMonth);
                principalPerYearData.push(annualPrincipalAccumulator);
                portfolioData.push(currentPortfolio);
                portfolioPaymentData.push(paymentFromPortfolio);

                const currentHomeEquity = currentHomeValue - currentBalance;
                homeEquityData.push(currentHomeEquity);
                netWorthData.push(currentHomeEquity + currentPortfolio);

                annualPrincipalAccumulator = 0;
            }
        }
        previousBalance = currentBalance;
    }

    // Update UI Stats
    monthlyPaymentVal.textContent = formatCurrency(actualMonthlyPayment);
    totalInterestVal.textContent = formatCurrency(totalInterest);
    totalCostVal.textContent = formatCurrency(P + totalInterest);

    // Save off data to be able to apply filters
    fullDataStore = {
        labels,
        balanceData,
        interestPerMonthData,
        principalPerYearData,
        portfolioData,
        portfolioPaymentData,
        homeEquityData,
        netWorthData
    };

    renderCharts();
}

function processTimeframeFilter(timeframeValue, labels, ...datasets) {
    if (timeframeValue === 'all') return [labels, ...datasets];

    const limit = parseInt(timeframeValue, 10);
    const filteredLabels = [];
    const filteredDatasets = datasets.map(() => []);

    for (let i = 0; i < labels.length; i++) {
        // label format: "Year X" or "Year X.X"
        const yearVal = parseFloat(labels[i].replace('Year ', ''));
        if (yearVal <= limit) {
            filteredLabels.push(labels[i]);
            datasets.forEach((data, index) => {
                filteredDatasets[index].push(data[i]);
            });
        }
    }

    return [filteredLabels, ...filteredDatasets];
}

function renderCharts() {
    if (!fullDataStore.labels) return;

    // Filter Mortgage Chart
    const [mortgageLabels, fBalanceData, fInterestPerMonthData, fPrincipalPerYearData] = processTimeframeFilter(
        mortgageTimeframeInput.value,
        fullDataStore.labels,
        fullDataStore.balanceData,
        fullDataStore.interestPerMonthData,
        fullDataStore.principalPerYearData
    );
    updateChart(mortgageLabels, fBalanceData, fInterestPerMonthData, fPrincipalPerYearData);

    // Filter Portfolio Chart
    const [portfolioLabels, fPortfolioData, fPortfolioPaymentData] = processTimeframeFilter(
        portfolioTimeframeInput.value,
        fullDataStore.labels,
        fullDataStore.portfolioData,
        fullDataStore.portfolioPaymentData
    );
    updatePortfolioChart(portfolioLabels, fPortfolioData, fPortfolioPaymentData);

    // Filter Net Worth Chart
    const [netWorthLabels, fNetWorthData, fHomeEquityData, fPortfolioNetWorthData] = processTimeframeFilter(
        netWorthTimeframeInput.value,
        fullDataStore.labels,
        fullDataStore.netWorthData,
        fullDataStore.homeEquityData,
        fullDataStore.portfolioData
    );
    updateNetWorthChart(netWorthLabels, fNetWorthData, fHomeEquityData, fPortfolioNetWorthData);
}

function updateChart(labels, balanceData, interestPerMonthData, principalPerYearData) {
    const ctx = document.getElementById('mortgageChart').getContext('2d');

    if (mortgageChart) {
        mortgageChart.destroy();
    }

    // Chart.js global defaults for beautiful dark mode
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Gradient for Balance area
    const balanceGradient = ctx.createLinearGradient(0, 0, 0, 400);
    balanceGradient.addColorStop(0, 'rgba(88, 166, 255, 0.4)');
    balanceGradient.addColorStop(1, 'rgba(88, 166, 255, 0.0)');

    mortgageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Balance Remaining',
                    data: balanceData,
                    borderColor: '#58a6ff',
                    backgroundColor: balanceGradient,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Principal Paid (Per Year)',
                    data: principalPerYearData,
                    type: 'bar',
                    backgroundColor: 'rgba(163, 113, 247, 0.7)',
                    borderColor: '#a371f7',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    borderRadius: 4,
                    barPercentage: 0.6
                },
                {
                    label: 'Interest per Month (At Year End)',
                    data: interestPerMonthData,
                    borderColor: '#f0883e',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y2',
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 13
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e6edf3',
                    borderColor: 'rgba(48, 54, 61, 0.8)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Balance ($)',
                        color: '#58a6ff'
                    },
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    },
                    border: { dash: [4, 4] }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Yearly Principal ($)',
                        color: '#a371f7'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
                y2: {
                    type: 'linear',
                    display: false, /* Hide axis to keep clean, but values scale correctly */
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

function updatePortfolioChart(labels, portfolioData, monthlyPaymentData) {
    const ctx = document.getElementById('portfolioChart').getContext('2d');

    if (portfolioChart) {
        portfolioChart.destroy();
    }

    const portfolioGradient = ctx.createLinearGradient(0, 0, 0, 400);
    portfolioGradient.addColorStop(0, 'rgba(46, 160, 67, 0.4)');
    portfolioGradient.addColorStop(1, 'rgba(46, 160, 67, 0.0)');

    portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Portfolio Value',
                    data: portfolioData,
                    borderColor: '#3fb950',
                    backgroundColor: portfolioGradient,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Monthly Payment (Withdrawn)',
                    data: monthlyPaymentData,
                    borderColor: '#f85149',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0,
                    yAxisID: 'y1',
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 13 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e6edf3',
                    borderColor: 'rgba(48, 54, 61, 0.8)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Portfolio Value ($)',
                        color: '#3fb950'
                    },
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    },
                    border: { dash: [4, 4] }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Monthly Payment ($)',
                        color: '#f85149'
                    },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function updateNetWorthChart(labels, netWorthData, homeEquityData, portfolioData) {
    const ctx = document.getElementById('netWorthChart').getContext('2d');

    if (netWorthChart) {
        netWorthChart.destroy();
    }

    const netWorthGradient = ctx.createLinearGradient(0, 0, 0, 400);
    netWorthGradient.addColorStop(0, 'rgba(163, 113, 247, 0.4)');
    netWorthGradient.addColorStop(1, 'rgba(163, 113, 247, 0.0)');

    netWorthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Net Worth',
                    data: netWorthData,
                    borderColor: '#a371f7',
                    backgroundColor: netWorthGradient,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Home Equity',
                    data: homeEquityData,
                    borderColor: '#58a6ff',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Portfolio Value',
                    data: portfolioData,
                    borderColor: '#3fb950',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 13 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e6edf3',
                    borderColor: 'rgba(48, 54, 61, 0.8)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Value ($)',
                        color: '#a371f7'
                    },
                    grid: {
                        color: 'rgba(48, 54, 61, 0.5)',
                        drawBorder: false
                    },
                    border: { dash: [4, 4] }
                }
            }
        }
    });
}

const inputs = [
    loanAmountInput, interestRateInput, loanTermInput, extraPaymentInput,
    initialPortfolioInput, marketReturnInput, homeValueInput, homeAppreciationRateInput
];

inputs.forEach(input => {
    input.addEventListener('input', calculateMortgage);
});

const timeframeInputs = [mortgageTimeframeInput, portfolioTimeframeInput, netWorthTimeframeInput];
timeframeInputs.forEach(input => {
    input.addEventListener('change', renderCharts);
});

// Initial calculation
calculateMortgage();
