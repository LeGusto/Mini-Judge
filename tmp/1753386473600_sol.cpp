#include <bits/stdc++.h>

#define fori(n) for (int i = 0; i < n; i++)
#define forj(n) for (int j = 0; j < n; j++)
#define ll long long

using namespace std;
map<int, bool> dp;

void solve()
{
    ll n;
    cin >> n;
    vector<ll> ans;

    while (!dp[n])
    {
        dp[n] = true;
        ans.push_back(n);
        if (n == 1)
            break;
        if (!(n & 1))
            n /= 2;
        else
            n = n * 3 + 1;
    }

    for (auto i : ans)
        cout << i << " ";
}

int main()
{
    int t;
    t = 1;
    // cin>>t;
    while (t)
    {
        t--;
        solve();
    }
}
