#include <bits/stdc++.h>

using namespace std;

const int MAXN = 1000001;
int dp[MAXN];

void solve() {
    int n, x;
    cin >> n >> x;

    // Initialize dp array
    fill(dp, dp + x + 1, INT_MAX);
    dp[0] = 0;

    // Read coin denominations
    vector<int> coins(n);
    for(int i = 0; i < n; i++) {
        cin >> coins[i];
    }

    // DP computation
    for(int i = 0; i <= x; i++) {
        if(dp[i] == INT_MAX) continue;
        for(int coin : coins) {
            if(i + coin <= x) {
                dp[i + coin] = min(dp[i + coin], dp[i] + 1);
            }
        }
    }

    // Output result
    if(dp[x] == INT_MAX) {
        cout << -1 << endl;
    } else {
        cout << dp[x] << endl;
    }
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(NULL);

    solve();
    return 0;
}