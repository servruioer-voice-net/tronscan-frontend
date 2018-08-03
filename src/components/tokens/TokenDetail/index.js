import React, {Fragment} from "react";
import {Client} from "../../../services/api";
import Avatar from "../../common/Avatar";
import {t, tu} from "../../../utils/i18n";
import {FormattedDate, FormattedNumber, FormattedRelative, FormattedTime, injectIntl} from "react-intl";
import {TokenHolders} from "./TokenHolders";
import {NavLink, Route, Switch} from "react-router-dom";
import {AddressLink, ExternalLink} from "../../common/Links";
import {TronLoader} from "../../common/loaders";
import {addDays, getTime} from "date-fns";
import Transfers from "../../common/Transfers";
import {ONE_TRX} from "../../../constants";
import {NumberField} from "../../common/Fields";
import {connect} from "react-redux";
import SweetAlert from "react-bootstrap-sweetalert";

class TokenDetail extends React.Component {

  constructor() {
    super();

    this.state = {
      loading: true,
      token: {},
      tabs: [],
      buyAmount: 0,
      alert: null,
    };
  }

  componentDidMount() {
    let {match} = this.props;
    this.loadToken(decodeURI(match.params.name));
  }

  componentDidUpdate(prevProps) {
    let {match} = this.props;

    if (match.params.name !== prevProps.match.params.name) {
      this.loadToken(decodeURI(match.params.name));
    }
  }

  loadToken = async (name) => {

    this.setState({loading: true, token: {name}});

    let token = await Client.getToken(name);
    let {total: totalAddresses} = await Client.getTokenHolders(name);

    this.setState({
      loading: false,
      token,
      tabs: [
        {
          id: "transactions",
          icon: "fa fa-exchange-alt",
          path: "",
          label: <span>{tu("token_transfers")}</span>,
          cmp: () => <Transfers filter={{token: name}}/>
        },
        {
          id: "holders",
          icon: "fa fa-user",
          path: "/holders",
          label: <span>{totalAddresses} {tu("token_holders")}</span>,
          cmp: () => <TokenHolders filter={{token: name}} token={{totalSupply: token.totalSupply}}/>
        },
      ]
    });
  };

  buyTokens = (token) => {
    let {buyAmount} = this.state;
    let {currentWallet, wallet} = this.props;

    if (!wallet.isOpen) {
      this.setState({
        alert: (
            <SweetAlert
                warning
                title="Open wallet"
                onConfirm={() => this.setState({alert: null})}>
              Open a wallet to participate
            </SweetAlert>
        ),
      });
      return;
    }

    let tokenCosts = buyAmount * (token.price / ONE_TRX);

    if ((currentWallet.balance / ONE_TRX) < tokenCosts) {
      this.setState({
        alert: (
            <SweetAlert
                warning
                title={tu("insufficient_trx")}
                onConfirm={() => this.setState({alert: null})}
            >
              {tu("not_enough_trx_message")}
            </SweetAlert>
        ),
      });
    } else {
      this.setState({
        alert: (
            <SweetAlert
                info
                showCancel
                confirmBtnText={tu("confirm_transaction")}
                confirmBtnBsStyle="success"
                cancelBtnText={tu("cancel")}
                cancelBtnBsStyle="default"
                title={tu("buy_confirm_message_0")}
                onConfirm={() => this.confirmTransaction(token)}
                onCancel={() => this.setState({alert: null})}
            >
              {tu("buy_confirm_message_1")}<br/>
              {buyAmount} {token.name} {t("for")} {buyAmount * (token.price / ONE_TRX)} TRX?
            </SweetAlert>
        ),
      });
    }
  };

  submit = async (token) => {

    let {account, currentWallet} = this.props;
    let {buyAmount} = this.state;

    let isSuccess = await Client.participateAsset(
        currentWallet.address,
        token.ownerAddress,
        token.name,
        buyAmount * token.price)(account.key);

    if (isSuccess) {
      this.setState({
        activeToken: null,
        confirmedParticipate: true,
        participateSuccess: isSuccess,
        buyAmount: 0,
      });

      return true;
    } else {
      return false;
    }
  };

  confirmTransaction = async (token) => {

    this.setState({
      alert: (
          <SweetAlert
              showConfirm={false}
              showCancel={false}
              cancelBtnBsStyle="default"
              title="One moment please.."
          >
            Requesting tokens...
          </SweetAlert>
      ),
    });

    if (await this.submit(token)) {
      this.setState({
        alert: (
            <SweetAlert success title="Transaction Confirmed" onConfirm={() => this.setState({alert: null})}>
              Successfully received {token.name} tokens
            </SweetAlert>
        )
      });
    } else {
      this.setState({
        alert: (
            <SweetAlert danger title="Error" onConfirm={() => this.setState({alert: null})}>
              Something went wrong...
            </SweetAlert>
        )
      });
    }
  };

  isBuyValid = () => {
    return (this.state.buyAmount > 0);
  };

  render() {

    let {match, wallet} = this.props;
    let {token, tabs, loading, buyAmount, alert} = this.state;

    return (
        <main className="container header-overlap">
          {alert}
          {
            loading ? <div className="card">
                  <TronLoader>
                    {tu("loading_token")} {token.name}
                  </TronLoader>
                </div> :
                <div className="row">
                  <div className="col-sm-12">
                    <div className="card">
                      <div className="card-body">
                        <Avatar value={token.name} className="float-right"/>
                        <h5 className="card-title">
                          {token.name}
                        </h5>
                        <p className="card-text">{token.description}</p>
                      </div>
                      <table className="table m-0">
                        <tbody>
                        <tr>
                          <th style={{width: 250}}>{tu("website")}:</th>
                          <td>
                            <ExternalLink url={token.url}/>
                          </td>
                        </tr>
                        <tr>
                          <th style={{width: 250}}>{tu("total_supply")}:</th>
                          <td>
                            <FormattedNumber value={token.totalSupply}/>
                          </td>
                        </tr>
                        {
                          token.frozen.length > 0 &&
                          <tr>
                            <th>{tu("Frozen Supply")}:</th>
                            <td>
                              {
                                token.frozen.map((frozen, index) => (
                                    <div key={index}>
                                      {frozen.amount} {tu("can_be_unlocked")}&nbsp;
                                      <FormattedRelative
                                          value={getTime(addDays(new Date(token.startTime), frozen.days))}/>
                                    </div>
                                ))
                              }
                            </td>
                          </tr>
                        }
                        <tr>
                          <th>{tu("issuer")}:</th>
                          <td>
                            <AddressLink address={token.ownerAddress}/>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("start_date")}:</th>
                          <td>
                            <FormattedDate value={token.startTime}/>{' '}
                            <FormattedTime value={token.startTime}/>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("end_date")}:</th>
                          <td>
                            <FormattedDate value={token.endTime}/>{' '}
                            <FormattedTime value={token.endTime}/>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("token_holders")}:</th>
                          <td>
                            <FormattedNumber value={token.nrOfTokenHolders}/>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("nr_of_Transfers")}:</th>
                          <td>
                            <FormattedNumber value={token.totalTransactions}/>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("progress")}:</th>
                          <td>
                            <div className="progress mt-1">
                              <div className="progress-bar bg-success" style={{width: (100 - token.percentage) + '%'}}/>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("price")}:</th>
                          <td>
                            <FormattedNumber value={(token.price / ONE_TRX)}/> TRX
                          </td>
                        </tr>
                        <tr>
                          <th>{tu("participate")}:</th>
                          <td>
                            <div className="input-group">
                              {
                                token.remaining!==0 &&
                                <NumberField
                                    className="form-control"
                                    value={buyAmount}
                                    max={token.remaining}
                                    min={1}
                                    onChange={value => this.setState({buyAmount: value})}
                                />
                              }
                              <div className="input-group-append">
                                <button className="btn btn-success"
                                        type="button"
                                        disabled={!this.isBuyValid()}
                                        onClick={() => this.buyTokens(token)}>
                                  Participate
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="card mt-3">
                      <div className="card-header">
                        <ul className="nav nav-tabs card-header-tabs">
                          {
                            tabs.map(tab => (
                                <li key={tab.id} className="nav-item">
                                  <NavLink exact to={match.url + tab.path} className="nav-link text-dark">
                                    <i className={tab.icon + " mr-2"}/>
                                    {tab.label}
                                  </NavLink>
                                </li>
                            ))
                          }
                        </ul>
                      </div>
                      <div className="card-body p-0">
                        <Switch>
                          {
                            tabs.map(tab => (
                                <Route key={tab.id} exact path={match.url + tab.path} render={() => (<tab.cmp/>)}/>
                            ))
                          }
                        </Switch>
                      </div>
                    </div>
                  </div>
                </div>
          }

        </main>
    )
  }
}


function mapStateToProps(state) {
  return {
    tokens: state.tokens.tokens,
    wallet: state.wallet,
    currentWallet: state.wallet.current,
    account: state.app.account,
  };
}

const mapDispatchToProps = {};

export default connect(mapStateToProps, mapDispatchToProps)(injectIntl(TokenDetail));